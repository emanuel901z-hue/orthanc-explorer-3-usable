import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Image,
  HardDrive,
  FileText,
  Download,
  Send,
  Eye,
  Trash2,
  Pencil,
  Shield,
  LayoutGrid,
  List,
  Loader2,
  GitMerge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useSeries,
  useSeriesInstances,
  useStudy,
  useInstancePreview,
  useSeriesSharedTags,
} from '@/features/studies/hooks/use-studies';
import DicomTagBrowser from '@/features/studies/components/DicomTagBrowser';
import {
  ModalityBadge,
  formatDiskSize,
  formatPatientName,
} from '@/shared/components/ModalityBadge';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import ModifySeriesDialog from '@/features/series/components/ModifySeriesDialog';
import MigrateSeriesDialog from '@/features/series/components/MigrateSeriesDialog';
import { useTabLabel } from '@/shared/hooks/use-tab-label';
import { AnonymizeDialog } from '@/features/studies/components/AnonymizeDialog';
import { useAuditLog } from '@/features/audit/hooks/use-audit-log';
import { seriesApi } from '@/api/series';
import { toast } from 'sonner';
import { useFeature } from '@/config/features';

function InstanceThumbnail({
  instanceId,
  instanceNumber,
  onClick,
}: {
  instanceId: string;
  instanceNumber: number;
  onClick: () => void;
}) {
  const { data: previewBlob, isLoading } = useInstancePreview(instanceId);
  const previewUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <div
      className="aspect-square bg-black rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all relative group"
      onClick={onClick}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
      )}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Instance #${instanceNumber}`}
          className="w-full h-full object-cover"
        />
      ) : !isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Image className="h-4 w-4 text-muted-foreground mb-0.5" />
          <span className="text-[10px] text-muted-foreground">#{instanceNumber}</span>
        </div>
      ) : null}
      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white/70 bg-black/40 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        #{instanceNumber}
      </span>
    </div>
  );
}

const SOP_CLASS_NAMES: Record<string, string> = {
  '1.2.840.10008.5.1.4.1.1.2': 'CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.4': 'MR Image Storage',
  '1.2.840.10008.5.1.4.1.1.128': 'PET Image Storage',
  '1.2.840.10008.5.1.4.1.1.7': 'Secondary Capture',
  '1.2.840.10008.5.1.4.1.1.6.1': 'Ultrasound Image Storage',
  '1.2.840.10008.5.1.4.1.1.1': 'Digital X-Ray (Presentation)',
  '1.2.840.10008.5.1.4.1.1.1.1': 'Digital Mammography (Presentation)',
  '1.2.840.10008.5.1.4.1.1.481.1': 'RT Image Storage',
  '1.2.840.10008.5.1.4.1.1.481.3': 'RT Structure Set Storage',
  '1.2.840.10008.5.1.4.1.1.66.4': 'Segmentation Storage',
};

function formatDicomTime(t?: string): string {
  if (!t) return '—';
  return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
}

function formatSlicePosition(pos?: string): string {
  if (!pos) return '—';
  const parts = pos.split('\\');
  if (parts.length === 3) return parseFloat(parts[2]).toFixed(2);
  return pos;
}

export default function SeriesDetailPage() {
  const { t } = useTranslation();
  const { studyId, seriesId } = useParams<{ studyId: string; seriesId: string }>();
  const navigate = useNavigate();
  const { data: series, isLoading } = useSeries(seriesId!);
  const { data: study } = useStudy(studyId!);
  const { data: rawInstances = [], isLoading: instancesLoading } = useSeriesInstances(seriesId!);
  const instances = useMemo(
    () => [...rawInstances].sort((a, b) => a.instanceNumber - b.instanceNumber),
    [rawInstances],
  );
  const { data: seriesTags } = useSeriesSharedTags(seriesId!);

  const canDownload = useFeature('download');
  const canSend = useFeature('send');
  const canModify = useFeature('modify');
  const canAnonymize = useFeature('anonymize');
  const canDelete = useFeature('delete');

  const sopClassUID = seriesTags?.find((tg) => tg.name === 'SOPClassUID')?.value;
  const sopClassName = sopClassUID ? SOP_CLASS_NAMES[sopClassUID] : undefined;

  const [sendOpen, setSendOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [instanceView, setInstanceView] = useState<'grid' | 'table'>('grid');
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { audit } = useAuditLog();

  useTabLabel(study ? formatPatientName(study.patientName) : undefined);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-muted-foreground">{t('series.notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/studies/${studyId}`)}>
          {t('series.backToStudy')}
        </Button>
      </div>
    );
  }

  const totalSize = instances.reduce((sum, i) => sum + i.fileSize, 0);

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      {/* Screen-reader-only H1 for accessibility — visible title is the breadcrumb */}
      <h1 className="sr-only">{t('series.seriesNumber', { number: series.seriesNumber })}</h1>
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/studies');
                }}
              >
                {t('nav.studies')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/studies/${studyId}`);
                }}
              >
                {study ? formatPatientName(study.patientName) : studyId}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('series.seriesNumber', { number: series.seriesNumber })}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> {t('series.viewer')}
          </Button>
          {canDownload && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={downloading}
                    onClick={async () => {
                      setDownloading(true);
                      try {
                        const blob = await seriesApi.archive(series.id);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${formatPatientName(study?.patientName ?? 'patient')}_Series${series.seriesNumber}.zip`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        audit({
                          action: 'download',
                          title: t('series.auditDownloaded', { number: series.seriesNumber }),
                          resource: series.seriesInstanceUID,
                          severity: 'info',
                          metadata: { [t('series.metadata.seriesId')]: series.id, [t('series.metadata.instances')]: String(series.numberOfInstances) },
                        });
                        toast.success(t('series.downloadSuccess'));
                      } catch {
                        toast.error(t('series.downloadFailed'));
                      } finally {
                        setDownloading(false);
                      }
                    }}
                  >
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {t('series.download')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('series.downloadTooltip')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {canSend && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setSendOpen(true);
                audit({
                  action: 'send',
                  title: t('series.auditSendInitiated', { number: series.seriesNumber }),
                  resource: series.seriesInstanceUID,
                });
              }}
            >
              <Send className="h-3.5 w-3.5" /> {t('series.send')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setMigrateOpen(true);
              audit({
                action: 'modify',
                title: t('series.auditMigrateInitiated', { number: series.seriesNumber }),
                resource: series.seriesInstanceUID,
              });
            }}
          >
            <GitMerge className="h-3.5 w-3.5" /> {t('series.migrate')}
          </Button>
          {canModify && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                audit({
                  action: 'modify',
                  title: t('series.auditModifyInitiated', { number: series.seriesNumber }),
                  resource: series.seriesInstanceUID,
                });
                setModifyOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> {t('series.modify')}
            </Button>
          )}
          {canAnonymize && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setAnonOpen(true);
                audit({
                  action: 'anonymize',
                  title: t('series.auditAnonymizeInitiated', { number: series.seriesNumber }),
                  resource: series.seriesInstanceUID,
                });
              }}
            >
              <Shield className="h-3.5 w-3.5" /> {t('series.anonymize')}
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> {t('series.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    {t('series.deleteTitle', { number: series.seriesNumber })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('series.deleteDescription', {
                      number: series.seriesNumber,
                      description: series.seriesDescription || series.modality,
                      count: series.numberOfInstances,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        await seriesApi.delete(series.id);
                        audit({
                          action: 'delete',
                          title: t('series.auditDeleted', { number: series.seriesNumber }),
                          severity: 'warning',
                          resource: series.seriesInstanceUID,
                          metadata: { [t('series.metadata.seriesId')]: series.id, [t('series.metadata.instances')]: String(series.numberOfInstances) },
                        });
                        toast.success(t('series.deleteSuccess'));
                        navigate(`/studies/${studyId}`);
                      } catch {
                        toast.error(t('series.deleteFailed'));
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    {t('series.deletePermanently')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('series.overview')}</TabsTrigger>
          <TabsTrigger value="tags">{t('series.dicomTags')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Series Info */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('series.seriesInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <ModalityBadge modality={series.modality} />
                    <span className="text-lg font-semibold">{t('series.seriesNumber', { number: series.seriesNumber })}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">{t('series.description')}</span>
                    <span>{series.seriesDescription || '—'}</span>
                    <span className="text-muted-foreground">{t('series.modality')}</span>
                    <span>{series.modality}</span>
                    {sopClassUID && (
                      <>
                        <span className="text-muted-foreground">{t('series.sopClass')}</span>
                        <span title={sopClassUID}>{sopClassName ?? sopClassUID}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">{t('series.seriesNumberLabel')}</span>
                    <span>{series.seriesNumber}</span>
                    <span className="text-muted-foreground">{t('series.instances')}</span>
                    <span>{series.numberOfInstances}</span>
                    {series.bodyPartExamined && (
                      <>
                        <span className="text-muted-foreground">{t('series.bodyPart')}</span>
                        <span>{series.bodyPartExamined}</span>
                      </>
                    )}
                    {series.protocolName && (
                      <>
                        <span className="text-muted-foreground">{t('series.protocol')}</span>
                        <span>{series.protocolName}</span>
                      </>
                    )}
                    {series.seriesDate && (
                      <>
                        <span className="text-muted-foreground">{t('series.seriesDate')}</span>
                        <span>{series.seriesDate}</span>
                      </>
                    )}
                    {series.seriesTime && (
                      <>
                        <span className="text-muted-foreground">{t('series.seriesTime')}</span>
                        <span>{series.seriesTime}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('series.statistics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-muted">
                      <Image className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{instances.length}</div>
                      <div className="text-xs text-muted-foreground">{t('series.images')}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <HardDrive className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{formatDiskSize(totalSize)}</div>
                      <div className="text-xs text-muted-foreground">{t('series.totalSize')}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">
                        {formatDiskSize(instances.length > 0 ? totalSize / instances.length : 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t('series.avgSize')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('series.identifiers')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">
                      {t('series.seriesInstanceUid')}
                    </span>
                    <code className="font-dicom text-xs break-all">{series.seriesInstanceUID}</code>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Instance list with toggle */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('series.instancesCount', { count: instances.length })}
                    </CardTitle>
                    <ToggleGroup
                      type="single"
                      value={instanceView}
                      onValueChange={(v) => v && setInstanceView(v as 'grid' | 'table')}
                      size="sm"
                    >
                      <ToggleGroupItem value="grid" aria-label={t('series.gridView')}>
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="table" aria-label={t('series.tableView')}>
                        <List className="h-3.5 w-3.5" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent>
                  {instanceView === 'grid' ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {instances.map((inst) => (
                        <InstanceThumbnail
                          key={inst.id}
                          instanceId={inst.id}
                          instanceNumber={inst.instanceNumber}
                          onClick={() =>
                            navigate(`/studies/${studyId}/series/${seriesId}/instances/${inst.id}`)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>{t('series.sopInstanceUid')}</TableHead>
                            <TableHead>{t('series.positionZ')}</TableHead>
                            <TableHead>{t('series.fileSize')}</TableHead>
                            <TableHead>{t('series.acqTime')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {instancesLoading
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                </TableRow>
                              ))
                            : instances.map((inst) => (
                                <TableRow
                                  key={inst.id}
                                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() =>
                                    navigate(`/studies/${studyId}/series/${seriesId}/instances/${inst.id}`)
                                  }
                                >
                                  <TableCell className="font-medium">{inst.instanceNumber}</TableCell>
                                  <TableCell className="font-mono text-xs truncate max-w-[300px]">{inst.sopInstanceUID}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{formatSlicePosition(inst.imagePositionPatient)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{formatDiskSize(inst.fileSize)}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{formatDicomTime(inst.acquisitionTime)}</TableCell>
                                </TableRow>
                              ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('series.seriesLevelTags')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DicomTagBrowser
                study={{
                  patientName: study ? study.patientName : '',
                  patientId: study ? study.patientId : '',
                  patientBirthDate: study?.patientBirthDate,
                  patientSex: study?.patientSex,
                  studyInstanceUID: study?.studyInstanceUID ?? '',
                  studyDate: study?.studyDate ?? new Date(0),
                  studyDescription: study?.studyDescription,
                  accessionNumber: study?.accessionNumber,
                }}
                tags={seriesTags ?? []}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {series && (
        <SendStudyDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          level="series"
          studies={[
            {
              id: series.id,
              patientName: t('series.seriesNumber', { number: series.seriesNumber }),
              studyDescription: series.seriesDescription,
            },
          ]}
        />
      )}
      {series && (
        <AnonymizeDialog
          open={anonOpen}
          onOpenChange={setAnonOpen}
          level="series"
          resourceId={series.id}
          resourceLabel={series.seriesDescription || t('series.seriesNumber', { number: series.seriesNumber })}
        />
      )}
      {series && studyId && (
        <MigrateSeriesDialog
          open={migrateOpen}
          onOpenChange={setMigrateOpen}
          series={series}
          currentStudyId={studyId}
        />
      )}
      {series && (
        <ModifySeriesDialog
          open={modifyOpen}
          onOpenChange={setModifyOpen}
          series={series}
          tags={seriesTags ?? []}
        />
      )}
    </div>
  );
}
