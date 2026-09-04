import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Image, Send, Eye, Trash2, Pencil, Shield, Search, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInstance, useStudy, useSeries, useInstancePreview, useInstanceTransferSyntax } from '@/features/studies/hooks/use-studies';
import { formatDiskSize, formatPatientName } from '@/shared/components/ModalityBadge';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import MigrateSeriesDialog from '@/features/series/components/MigrateSeriesDialog';
import { useTabLabel } from '@/shared/hooks/use-tab-label';
import { AnonymizeDialog } from '@/features/studies/components/AnonymizeDialog';
import { useAuditLog } from '@/features/audit/hooks/use-audit-log';
import { useFeature } from '@/config/features';
import type { DicomTag } from '@/shared/types';

const SOP_CLASS_NAMES: Record<string, string> = {
  '1.2.840.10008.5.1.4.1.1.2':     'CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.4':     'MR Image Storage',
  '1.2.840.10008.5.1.4.1.1.128':   'PET Image Storage',
  '1.2.840.10008.5.1.4.1.1.7':     'Secondary Capture',
  '1.2.840.10008.5.1.4.1.1.6.1':   'Ultrasound Image Storage',
  '1.2.840.10008.5.1.4.1.1.1':     'Digital X-Ray (Presentation)',
  '1.2.840.10008.5.1.4.1.1.1.1':   'Digital Mammography (Presentation)',
  '1.2.840.10008.5.1.4.1.1.481.1': 'RT Image Storage',
  '1.2.840.10008.5.1.4.1.1.481.3': 'RT Structure Set Storage',
  '1.2.840.10008.5.1.4.1.1.66.4':  'Segmentation Storage',
};

const TRANSFER_SYNTAX_NAMES: Record<string, string> = {
  '1.2.840.10008.1.2':     'Implicit VR Little Endian',
  '1.2.840.10008.1.2.1':   'Explicit VR Little Endian',
  '1.2.840.10008.1.2.2':   'Explicit VR Big Endian',
  '1.2.840.10008.1.2.4.50': 'JPEG Baseline',
  '1.2.840.10008.1.2.4.51': 'JPEG Extended',
  '1.2.840.10008.1.2.4.57': 'JPEG Lossless',
  '1.2.840.10008.1.2.4.70': 'JPEG Lossless SV1',
  '1.2.840.10008.1.2.4.90': 'JPEG 2000 Lossless',
  '1.2.840.10008.1.2.4.91': 'JPEG 2000',
  '1.2.840.10008.1.2.5':    'RLE Lossless',
};

function tagValue(tags: DicomTag[], name: string): string | undefined {
  const v = tags.find((t) => t.name === name)?.value;
  return v || undefined;
}

function formatDicomDate(raw?: string): string {
  if (!raw || raw.length < 8) return '—';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function formatDicomTime(raw?: string): string {
  if (!raw || raw.length < 6) return '—';
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`;
}

function formatPixelSpacing(raw?: string): string {
  if (!raw) return '—';
  const parts = raw.split('\\');
  if (parts.length === 2) return `${parseFloat(parts[0]).toFixed(3)} × ${parseFloat(parts[1]).toFixed(3)} mm`;
  return raw;
}

export default function InstanceDetailPage() {
  const { t } = useTranslation();
  const { studyId, seriesId, instanceId } = useParams<{ studyId: string; seriesId: string; instanceId: string }>();
  const navigate = useNavigate();
  const { data: instance, isLoading } = useInstance(instanceId!);
  const { data: study } = useStudy(studyId!);
  const { data: seriesData } = useSeries(seriesId!);
  const { data: transferSyntax } = useInstanceTransferSyntax(instanceId!);
  const [tagSearch, setTagSearch] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const { audit } = useAuditLog();
  const { data: previewBlob } = useInstancePreview(instanceId!);

  const canDownload = useFeature('download');
  const canSend = useFeature('send');
  const canModify = useFeature('modify');
  const canAnonymize = useFeature('anonymize');
  const canDelete = useFeature('delete');

  const previewUrl = useMemo(() => (previewBlob ? URL.createObjectURL(previewBlob) : null), [previewBlob]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useTabLabel(study ? formatPatientName(study.patientName) : undefined);

  const filteredTags = useMemo(() => {
    if (!instance) return [];
    if (!tagSearch) return instance.tags;
    const q = tagSearch.toLowerCase();
    return instance.tags.filter(
      (tg) => tg.tag.toLowerCase().includes(q) || tg.name.toLowerCase().includes(q) || tg.value.toLowerCase().includes(q),
    );
  }, [instance, tagSearch]);

  const sopClassUID    = instance ? tagValue(instance.tags, 'SOPClassUID') : undefined;
  const rows           = instance ? tagValue(instance.tags, 'Rows') : undefined;
  const cols           = instance ? tagValue(instance.tags, 'Columns') : undefined;
  const pixelSpacing   = instance ? tagValue(instance.tags, 'PixelSpacing') : undefined;
  const sliceThickness = instance ? tagValue(instance.tags, 'SliceThickness') : undefined;
  const sliceLocation  = instance ? tagValue(instance.tags, 'SliceLocation') : undefined;
  const windowCenter   = instance ? tagValue(instance.tags, 'WindowCenter') : undefined;
  const windowWidth    = instance ? tagValue(instance.tags, 'WindowWidth') : undefined;
  const bitsAlloc      = instance ? tagValue(instance.tags, 'BitsAllocated') : undefined;
  const bitsStored     = instance ? tagValue(instance.tags, 'BitsStored') : undefined;
  const acqDate        = instance ? tagValue(instance.tags, 'AcquisitionDate') : undefined;
  const acqTime        = instance ? tagValue(instance.tags, 'AcquisitionTime') : undefined;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-muted-foreground">{t('instance.notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/studies/${studyId}/series/${seriesId}`)}>
          {t('instance.backToSeries')}
        </Button>
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
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate('/studies'); }}>{t('nav.studies')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate(`/studies/${studyId}`); }}>
                {study ? formatPatientName(study.patientName) : studyId}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate(`/studies/${studyId}/series/${seriesId}`); }}>
                {t('series.seriesNumber', { number: seriesData?.seriesNumber ?? '…' })}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('instance.instanceNumber', { number: instance.instanceNumber })}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t('instance.viewer')}</Button>
          {canDownload && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => audit({ action: 'download', title: t('instance.auditDownloaded'), resource: t('instance.instanceNumber', { number: instance.instanceNumber }), description: t('instance.auditDownloadDesc') })}>
                    <Download className="h-3.5 w-3.5" /> {t('instance.download')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('instance.downloadTooltip')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {canSend && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSendOpen(true); audit({ action: 'send', title: t('instance.auditSendInitiated'), resource: t('instance.instanceNumber', { number: instance.instanceNumber }) }); }}>
              <Send className="h-3.5 w-3.5" /> {t('instance.send')}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setMigrateOpen(true); audit({ action: 'modify', title: t('instance.auditMigrateInitiated'), resource: t('instance.instanceNumber', { number: instance.instanceNumber }) }); }}>
            <GitMerge className="h-3.5 w-3.5" /> {t('instance.migrate')}
          </Button>
          {canModify && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => audit({ action: 'modify', title: t('instance.auditModifyInitiated'), resource: t('instance.instanceNumber', { number: instance.instanceNumber }) })}>
              <Pencil className="h-3.5 w-3.5" /> {t('instance.modify')}
            </Button>
          )}
          {canAnonymize && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setAnonOpen(true); audit({ action: 'anonymize', title: t('instance.auditAnonymizeInitiated'), resource: t('instance.instanceNumber', { number: instance.instanceNumber }) }); }}>
              <Shield className="h-3.5 w-3.5" /> {t('instance.anonymize')}
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> {t('instance.delete')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('instance.deleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('instance.deleteDescription', { number: instance.instanceNumber, size: formatDiskSize(instance.fileSize) })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => audit({ action: 'delete', title: t('instance.auditDeleted'), severity: 'warning', resource: t('instance.instanceNumber', { number: instance.instanceNumber }), description: t('instance.auditDeleteDesc', { size: formatDiskSize(instance.fileSize) }) })}>
                    {t('instance.deletePermanently')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — metadata cards */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('instance.instanceInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">{t('instance.instanceNumberLabel')}</span>
                <span>{instance.instanceNumber}</span>
                <span className="text-muted-foreground">{t('instance.fileSize')}</span>
                <span>{formatDiskSize(instance.fileSize)}</span>
                {sopClassUID && (
                  <>
                    <span className="text-muted-foreground">{t('instance.sopClass')}</span>
                    <span title={sopClassUID}>{SOP_CLASS_NAMES[sopClassUID] ?? sopClassUID}</span>
                  </>
                )}
                {transferSyntax && (
                  <>
                    <span className="text-muted-foreground">{t('instance.transferSyntax')}</span>
                    <span title={transferSyntax}>{TRANSFER_SYNTAX_NAMES[transferSyntax] ?? transferSyntax}</span>
                  </>
                )}
              </div>

              {(rows || pixelSpacing || sliceThickness || sliceLocation) && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('instance.image')}</p>
                  <div className="grid grid-cols-2 gap-y-2">
                    {rows && cols && (
                      <>
                        <span className="text-muted-foreground">{t('instance.dimensions')}</span>
                        <span>{rows} × {cols} px</span>
                      </>
                    )}
                    {pixelSpacing && (
                      <>
                        <span className="text-muted-foreground">{t('instance.pixelSpacing')}</span>
                        <span>{formatPixelSpacing(pixelSpacing)}</span>
                      </>
                    )}
                    {sliceThickness && (
                      <>
                        <span className="text-muted-foreground">{t('instance.sliceThickness')}</span>
                        <span>{sliceThickness} mm</span>
                      </>
                    )}
                    {sliceLocation && (
                      <>
                        <span className="text-muted-foreground">{t('instance.sliceLocation')}</span>
                        <span>{parseFloat(sliceLocation).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {(windowCenter || bitsAlloc) && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('instance.pixelData')}</p>
                  <div className="grid grid-cols-2 gap-y-2">
                    {windowCenter && windowWidth && (
                      <>
                        <span className="text-muted-foreground">{t('instance.windowCW')}</span>
                        <span>{windowCenter} / {windowWidth}</span>
                      </>
                    )}
                    {bitsAlloc && bitsStored && (
                      <>
                        <span className="text-muted-foreground">{t('instance.bits')}</span>
                        <span>{t('instance.bitsValue', { stored: bitsStored, alloc: bitsAlloc })}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {(acqDate || acqTime) && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('instance.acquisition')}</p>
                  <div className="grid grid-cols-2 gap-y-2">
                    {acqDate && (
                      <>
                        <span className="text-muted-foreground">{t('instance.date')}</span>
                        <span>{formatDicomDate(acqDate)}</span>
                      </>
                    )}
                    {acqTime && (
                      <>
                        <span className="text-muted-foreground">{t('instance.time')}</span>
                        <span>{formatDicomTime(acqTime)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('instance.identifiers')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs mb-0.5">{t('instance.sopInstanceUid')}</span>
                <code className="font-mono text-xs break-all">{instance.sopInstanceUID}</code>
              </div>
              {sopClassUID && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-0.5">{t('instance.sopClassUid')}</span>
                  <code className="font-mono text-xs break-all">{sopClassUID}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 2 columns — preview + tags */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('instance.preview')}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center bg-black rounded-b-lg min-h-[240px]">
              {previewUrl ? (
                <img src={previewUrl} alt={t('instance.instanceNumber', { number: instance.instanceNumber })} className="max-h-[360px] w-auto object-contain rounded" />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Image className="h-12 w-12 mb-2 opacity-30" />
                  <p className="text-xs">{t('instance.loadingPreview')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('instance.dicomTags')}
                  <Badge variant="secondary" className="ml-2">{instance.tags.length}</Badge>
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t('instance.searchTags')}
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">{t('instance.tag')}</TableHead>
                      <TableHead className="w-16">{t('instance.vr')}</TableHead>
                      <TableHead>{t('instance.name')}</TableHead>
                      <TableHead>{t('instance.value')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTags.map((tag) => (
                      <TableRow key={tag.tag}>
                        <TableCell className="font-mono text-xs text-primary">{tag.tag}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] py-0 h-5 font-mono">{tag.vr}</Badge></TableCell>
                        <TableCell className="text-sm">{tag.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[300px] truncate">{tag.value}</TableCell>
                      </TableRow>
                    ))}
                    {filteredTags.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {t('instance.noTagsMatch', { search: tagSearch })}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SendStudyDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        studies={[{
          id: instance.id,
          patientName: t('instance.instanceNumber', { number: instance.instanceNumber }),
          studyDescription: formatDiskSize(instance.fileSize),
        }]}
      />
      <AnonymizeDialog
        open={anonOpen}
        onOpenChange={setAnonOpen}
        level="instance"
        resourceId={instance.id}
        resourceLabel={t('instance.instanceNumber', { number: instance.instanceNumber })}
      />
      {seriesData && studyId && (
        <MigrateSeriesDialog
          open={migrateOpen}
          onOpenChange={setMigrateOpen}
          series={seriesData}
          currentStudyId={studyId}
        />
      )}
    </div>
  );
}
