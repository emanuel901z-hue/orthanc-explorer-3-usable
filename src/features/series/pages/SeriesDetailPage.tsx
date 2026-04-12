import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Image, Layers, HardDrive, FileText, Download, Send, Eye, Trash2, Pencil, Shield, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSeries, useSeriesInstances, useStudy } from '@/features/studies/hooks/use-studies';
import { ModalityBadge, formatDiskSize, formatPatientName } from '@/shared/components/ModalityBadge';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import { useTabLabel } from '@/shared/hooks/use-tab-label';
import { AnonymizeDialog } from '@/features/studies/components/AnonymizeDialog';
import { useAuditLog } from '@/features/audit/hooks/use-audit-log';

export default function SeriesDetailPage() {
  const { t } = useTranslation();
  const { studyId, seriesId } = useParams<{ studyId: string; seriesId: string }>();
  const navigate = useNavigate();
  const { data: series, isLoading } = useSeries(seriesId!);
  const { data: study } = useStudy(studyId!);
  const { data: instances = [], isLoading: instancesLoading } = useSeriesInstances(seriesId!);
  const [sendOpen, setSendOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const [instanceView, setInstanceView] = useState<'grid' | 'table'>('table');
  const { audit } = useAuditLog();

  // Update tab label with patient name when loaded
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
        <p className="text-muted-foreground">Series not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/studies/${studyId}`)}>Back to Study</Button>
      </div>
    );
  }

  const totalSize = instances.reduce((sum, i) => sum + i.fileSize, 0);

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate('/studies'); }}>Studies</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate(`/studies/${studyId}`); }}>
                {study ? formatPatientName(study.patientName) : studyId}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Series #{series.seriesNumber}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Viewer</Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { audit({ action: 'download', title: 'Series downloaded', resource: `Series #${series.seriesNumber}`, description: `Downloaded series as DICOM ZIP archive` }); }}><Download className="h-3.5 w-3.5" /> Download</Button>
              </TooltipTrigger>
              <TooltipContent>Download as DICOM ZIP archive</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSendOpen(true); audit({ action: 'send', title: 'Series send initiated', resource: `Series #${series.seriesNumber}` }); }}><Send className="h-3.5 w-3.5" /> Send</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { audit({ action: 'modify', title: 'Series modify initiated', resource: `Series #${series.seriesNumber}` }); }}><Pencil className="h-3.5 w-3.5" /> Modify</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setAnonOpen(true); audit({ action: 'anonymize', title: 'Series anonymize initiated', resource: `Series #${series.seriesNumber}` }); }}><Shield className="h-3.5 w-3.5" /> Anonymize</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Series</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete Series #{series.seriesNumber} ({series.seriesDescription || series.modality}) and all {series.numberOfInstances} instance(s). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { audit({ action: 'delete', title: 'Series deleted', severity: 'warning', resource: `Series #${series.seriesNumber}`, description: `Deleted series with ${series.numberOfInstances} instance(s)` }); }}>Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Series Info */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Series Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <ModalityBadge modality={series.modality} />
                    <span className="text-lg font-semibold">Series #{series.seriesNumber}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Description</span>
                    <span>{series.seriesDescription || '—'}</span>
                    <span className="text-muted-foreground">Modality</span>
                    <span>{series.modality}</span>
                    <span className="text-muted-foreground">Series Number</span>
                    <span>{series.seriesNumber}</span>
                    <span className="text-muted-foreground">Instances</span>
                    <span>{series.numberOfInstances}</span>
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
                      <Image className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{instances.length}</div>
                      <div className="text-xs text-muted-foreground">Images</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <HardDrive className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{formatDiskSize(totalSize)}</div>
                      <div className="text-xs text-muted-foreground">Total Size</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{formatDiskSize(instances.length > 0 ? totalSize / instances.length : 0)}</div>
                      <div className="text-xs text-muted-foreground">Avg Size</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Identifiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Series Instance UID</span>
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
                      Instances ({instances.length})
                    </CardTitle>
                    <ToggleGroup type="single" value={instanceView} onValueChange={(v) => v && setInstanceView(v as 'grid' | 'table')} size="sm">
                      <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
                      <ToggleGroupItem value="table" aria-label="Table view"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent>
                  {instanceView === 'grid' ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {instances.map((inst) => (
                        <div
                          key={inst.id}
                          className="aspect-square bg-muted rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/70 hover:ring-1 hover:ring-primary/30 transition-all"
                          onClick={() => navigate(`/studies/${studyId}/series/${seriesId}/instances/${inst.id}`)}
                        >
                          <Image className="h-4 w-4 text-muted-foreground mb-0.5" />
                          <span className="text-[10px] text-muted-foreground">#{inst.instanceNumber}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>SOP Instance UID</TableHead>
                            <TableHead>SOP Class</TableHead>
                            <TableHead>File Size</TableHead>
                            <TableHead>Transfer Syntax</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {instancesLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              </TableRow>
                            ))
                          ) : (
                            instances.map((inst) => (
                              <TableRow
                                key={inst.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => navigate(`/studies/${studyId}/series/${seriesId}/instances/${inst.id}`)}
                              >
                                <TableCell className="font-medium">{inst.instanceNumber}</TableCell>
                                <TableCell className="font-mono text-xs truncate max-w-[300px]">{inst.sopInstanceUID}</TableCell>
                                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{inst.sopClassUID}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{formatDiskSize(inst.fileSize)}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{inst.transferSyntax}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {series && (
        <SendStudyDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          studies={[{
            id: series.id,
            patientName: `Series #${series.seriesNumber}`,
            studyDescription: series.seriesDescription,
          }]}
        />
      )}
      {series && (
        <AnonymizeDialog
          open={anonOpen}
          onOpenChange={setAnonOpen}
          level="series"
          resourceId={series.id}
          resourceLabel={series.seriesDescription || `Series #${series.seriesNumber}`}
        />
      )}
    </div>
  );
}
