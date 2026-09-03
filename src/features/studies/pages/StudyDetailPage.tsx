import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, Send, Eye, Shield, Pencil, Tag, HardDrive, Layers, Image, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudy, useStudySeries, useInstancePreview, useStudySharedTags } from '@/features/studies/hooks/use-studies';
import { ModalityBadge, formatPatientName, formatDiskSize } from '@/shared/components/ModalityBadge';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import { useTabLabel } from '@/shared/hooks/use-tab-label';
import { AnonymizeDialog } from '@/features/studies/components/AnonymizeDialog';
import DicomTagBrowser from '@/features/studies/components/DicomTagBrowser';
import StudyActivityLog from '@/features/studies/components/StudyActivityLog';
import { ModifyStudyDialog } from '@/features/studies/components/ModifyStudyDialog';
import { useAuditLog } from '@/features/audit/hooks/use-audit-log';
import { toast } from 'sonner';
import { deleteStudyAction } from '@/actions/deleteStudy';
import { downloadStudyAction } from '@/actions/downloadStudy';
import { OrthancError } from '@/lib/errors';
import type { OrthancStudy } from '@/api/studies';
import { useFeature } from '@/config/features';

function SeriesThumbnail({ instanceId }: { instanceId?: string }) {
  const { data: previewBlob, isLoading } = useInstancePreview(instanceId ?? '');
  const previewUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
  );
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  if (isLoading) return <Skeleton className="h-16 w-16 rounded shrink-0" />;
  if (previewUrl) {
    return (
      <div className="h-16 w-16 rounded overflow-hidden bg-black shrink-0">
        <img src={previewUrl} alt="Series preview" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="h-16 w-16 bg-muted rounded flex items-center justify-center shrink-0">
      <Image className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

export default function StudyDetailPage() {
  const { t } = useTranslation();
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: study, isLoading } = useStudy(studyId!);

  // RBAC feature flags — controlled by config.js (deployment-time)
  const canDownload = useFeature('download');
  const canSend = useFeature('send');
  const canModify = useFeature('modify');
  const canAnonymize = useFeature('anonymize');
  const canDelete = useFeature('delete');
  const { data: series = [] } = useStudySeries(studyId!);
  const { data: sharedTags } = useStudySharedTags(studyId!);
  const { audit } = useAuditLog();
  const [sendOpen, setSendOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [seriesView, setSeriesView] = useState<'grid' | 'table'>('table');

  const deleteMutation = useMutation({
    mutationFn: (orthancStudy: OrthancStudy) => deleteStudyAction(orthancStudy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      navigate('/studies');
    },
    onError: (err) => {
      const ref = err instanceof OrthancError ? ` (Ref: ${err.correlationId})` : '';
      toast.error(`Failed to delete study.${ref}`);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) =>
      downloadStudyAction(id, study ? `${formatPatientName(study.patientName)}.zip` : `${id}.zip`),
    onError: (err) => {
      const ref = err instanceof OrthancError ? ` (Ref: ${err.correlationId})` : '';
      toast.error(`Download failed.${ref}`);
    },
  });

  // Update tab label with patient name when loaded
  useTabLabel(study ? formatPatientName(study.patientName) : undefined);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-muted-foreground">Study not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/studies')}>Back to Studies</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate('/studies'); }}>{t('studies.title')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{formatPatientName(study.patientName)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/viewer/${studyId}`)}><Eye className="h-3.5 w-3.5" /> {t('actions.viewer')}</Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              // Set httpOnly cookie for OHIF/DICOMweb access (8h PACS token)
              try {
                await fetch('/api/v1/pacs/viewer-session', {
                  method: 'POST',
                  credentials: 'include',
                });
              } catch (e) {
                // Cookie may already be valid — continue to open OHIF
              }
              window.open(`/ohif/viewer?StudyInstanceUIDs=${study.studyInstanceUID}`, '_blank', 'noopener,noreferrer');
            }}
          >
            <Eye className="h-3.5 w-3.5" /> {t('actions.openInOhif')}
          </Button>
          {canDownload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={downloadMutation.isPending}
                  onClick={() => {
                    audit({ action: 'download', title: `Study downloaded: ${formatPatientName(study.patientName)}`, resource: study.studyInstanceUID, severity: 'info', metadata: { 'Study ID': studyId!, 'Format': 'DICOM ZIP' } });
                    downloadMutation.mutate(studyId!);
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> {t('actions.download')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download as DICOM ZIP archive</TooltipContent>
            </Tooltip>
          )}
          {canSend && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSendOpen(true)}><Send className="h-3.5 w-3.5" /> {t('actions.send')}</Button>
          )}
          {canModify && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModifyOpen(true)}><Pencil className="h-3.5 w-3.5" /> {t('actions.modify')}</Button>
          )}
          {canAnonymize && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAnonOpen(true)}><Shield className="h-3.5 w-3.5" /> {t('actions.anonymize')}</Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> {t('actions.delete')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    {t('studies.deleteStudy')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{formatPatientName(study.patientName)}</strong> and all {study.numberOfSeries} series ({study.numberOfInstances} instances). This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                    audit({ action: 'delete', title: `Study deleted: ${formatPatientName(study.patientName)}`, resource: study.studyInstanceUID, severity: 'warning', metadata: { 'Study ID': studyId!, 'Series': String(study.numberOfSeries), 'Instances': String(study.numberOfInstances) } });
                    deleteMutation.mutate({ ID: studyId!, MainDicomTags: {}, PatientMainDicomTags: {}, ParentPatient: '', Series: [], Type: 'Study' });
                  }}
                >
                  {t('studies.deletePermanently')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('studies.overview')}</TabsTrigger>
          <TabsTrigger value="tags">{t('studies.dicomTags')}</TabsTrigger>
          <TabsTrigger value="activity">{t('nav.activity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column - Patient & Study info */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Patient</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-lg font-semibold">{formatPatientName(study.patientName)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Patient ID</span>
                    <span className="font-mono text-xs">{study.patientId}</span>
                    {study.patientBirthDate && (
                      <>
                        <span className="text-muted-foreground">Birth Date</span>
                        <span>{format(study.patientBirthDate, 'MMM dd, yyyy')}</span>
                      </>
                    )}
                    {study.patientSex && (
                      <>
                        <span className="text-muted-foreground">Sex</span>
                        <span>{study.patientSex === 'M' ? 'Male' : study.patientSex === 'F' ? 'Female' : 'Other'}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Study Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(study.studyDate, 'MMM dd, yyyy')}</span>
                    {study.studyTime && (
                      <>
                        <span className="text-muted-foreground">Time</span>
                        <span>{study.studyTime}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Description</span>
                    <span>{study.studyDescription || '—'}</span>
                    <span className="text-muted-foreground">Accession #</span>
                    <span className="font-mono text-xs">{study.accessionNumber}</span>
                    <span className="text-muted-foreground">Modality</span>
                    <div className="flex gap-1">
                      {study.modalities.map((m) => <ModalityBadge key={m} modality={m} />)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-muted">
                      <Layers className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{study.numberOfSeries}</div>
                      <div className="text-xs text-muted-foreground">Series</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <Image className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{study.numberOfInstances}</div>
                      <div className="text-xs text-muted-foreground">Images</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <HardDrive className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{formatDiskSize(study.diskSize)}</div>
                      <div className="text-xs text-muted-foreground">Size</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {study.labels && study.labels.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Labels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1.5 flex-wrap">
                      {study.labels.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column - Series */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Series ({series.length})</CardTitle>
                    <ToggleGroup type="single" value={seriesView} onValueChange={(v) => v && setSeriesView(v as 'grid' | 'table')} size="sm">
                      <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
                      <ToggleGroupItem value="table" aria-label="Table view"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent>
                  {seriesView === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {series.map((s) => (
                        <div
                          key={s.id}
                          className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer flex gap-3"
                          onClick={() => navigate(`/studies/${studyId}/series/${s.id}`)}
                        >
                          <SeriesThumbnail instanceId={s.firstInstanceId} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <ModalityBadge modality={s.modality} />
                              <span className="text-xs text-muted-foreground">#{s.seriesNumber}</span>
                            </div>
                            <p className="text-sm font-medium truncate">{s.seriesDescription || 'No description'}</p>
                            <p className="text-xs text-muted-foreground">{s.numberOfInstances} instances</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Modality</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Instances</TableHead>
                            <TableHead>Series Instance UID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {series.map((s) => (
                            <TableRow
                              key={s.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => navigate(`/studies/${studyId}/series/${s.id}`)}
                            >
                              <TableCell className="font-medium">{s.seriesNumber}</TableCell>
                              <TableCell><ModalityBadge modality={s.modality} /></TableCell>
                              <TableCell className="text-sm">{s.seriesDescription || '—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{s.numberOfInstances}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[250px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate block">{s.seriesInstanceUID}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-md font-mono text-xs break-all">
                                    {s.seriesInstanceUID}
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* UID Info */}
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Identifiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Study Instance UID</span>
                    <code className="font-dicom text-xs break-all">{study.studyInstanceUID}</code>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Orthanc ID</span>
                    <code className="font-dicom text-xs">{study.id}</code>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tags">
          <Card>
            <CardContent className="pt-6">
              <DicomTagBrowser study={study} tags={sharedTags} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              <StudyActivityLog studyId={studyId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {study && (
        <SendStudyDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          studies={[{ id: study.id, patientName: formatPatientName(study.patientName), studyDescription: study.studyDescription }]}
        />
      )}
      {study && (
        <AnonymizeDialog
          open={anonOpen}
          onOpenChange={setAnonOpen}
          level="study"
          resourceId={study.id}
          resourceLabel={formatPatientName(study.patientName)}
        />
      )}
      {study && (
        <ModifyStudyDialog
          open={modifyOpen}
          onOpenChange={setModifyOpen}
          study={study}
          instanceCount={study.numberOfInstances}
        />
      )}
    </div>
  );
}
