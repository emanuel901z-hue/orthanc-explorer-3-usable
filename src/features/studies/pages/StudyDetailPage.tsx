import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, Send, Eye, Shield, Pencil, Tag, HardDrive, Layers, Image, LayoutGrid, List, AlertTriangle, Search, ArrowUp, ArrowDown, ArrowUpDown, Loader2, GitMerge, BookOpen, FolderArchive, Code, ExternalLink, Share2, Plus, Settings2, ChevronDown } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudy, useStudySeries, useInstancePreview, useStudySharedTags } from '@/features/studies/hooks/use-studies';
import { ModalityBadge, formatPatientName, formatDiskSize } from '@/shared/components/ModalityBadge';
import { requestViewerSession } from '@/lib/viewer-session';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import MigrateStudyDialog from '@/features/studies/components/MigrateStudyDialog';
import ShareStudyDialog from '@/features/studies/components/ShareStudyDialog';
import AddSeriesDialog from '@/features/studies/components/AddSeriesDialog';
import { loadCustomButtons, executeButton } from '@/lib/custom-buttons';
import { useTabLabel } from '@/shared/hooks/use-tab-label';
import { AnonymizeDialog } from '@/features/studies/components/AnonymizeDialog';
import DicomTagBrowser from '@/features/studies/components/DicomTagBrowser';
import StudyActivityLog from '@/features/studies/components/StudyActivityLog';
import { ModifyStudyDialog } from '@/features/studies/components/ModifyStudyDialog';
import { useAuditLog } from '@/features/audit/hooks/use-audit-log';
import { toast } from 'sonner';
import { deleteStudyAction } from '@/actions/deleteStudy';
import { deleteSeriesAction } from '@/actions/deleteSeries';import { downloadStudyAction } from '@/actions/downloadStudy';
import { OrthancError } from '@/lib/errors';
import { useFeature } from '@/config/features';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { toolsApi } from '@/api/tools';

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
  // null = no pixel data (SR/PR documents) or preview failed — show neutral placeholder
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
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [seriesView, setSeriesView] = useState<'grid' | 'table'>('table');
  const [seriesSearch, setSeriesSearch] = useState('');
  const [seriesSort, setSeriesSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'seriesNumber', dir: 'asc' });
  const [seriesColumnVisibility, setSeriesColumnVisibility] = useState<Record<string, boolean>>({
    select: true,
    seriesNumber: true,
    modality: true,
    seriesDescription: true,
    numberOfInstances: true,
    seriesInstanceUID: true,
  });
  const [showSeriesColumnConfig, setShowSeriesColumnConfig] = useState(false);
  const seriesColConfigRef = useRef<HTMLDivElement>(null);

  // Close the series column-config dropdown on outside click.
  useEffect(() => {
    if (!showSeriesColumnConfig) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (seriesColConfigRef.current && !seriesColConfigRef.current.contains(e.target as Node)) {
        setShowSeriesColumnConfig(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showSeriesColumnConfig]);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const deleteMutation = useMutation({
    mutationFn: (studyId: string) => deleteStudyAction(studyId),
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
    onSuccess: () => {
      toast.success(t('studyDetail.downloadStarted', { defaultValue: 'Download started' }));
    },
    onError: (err) => {
      const ref = err instanceof OrthancError ? ` (Ref: ${err.correlationId})` : '';
      toast.error(t('studyDetail.downloadFailed', { defaultValue: 'Download failed' }) + ref);
    },
  });

  // P0: DICOM-DIR download (ZIP with DICOMDIR index)
  const downloadDicomDirMutation = useMutation({
    mutationFn: (id: string) =>
      downloadStudyAction(
        id,
        study ? `${formatPatientName(study.patientName)}_DICOMDIR.zip` : `${id}_dicomdir.zip`,
        { dicomDir: true },
      ),
    onSuccess: () => toast.success(t('studyDetail.dicomDirStarted', { defaultValue: 'DICOM-DIR download started' })),
    onError: (err) => {
      const ref = err instanceof OrthancError ? ` (Ref: ${err.correlationId})` : '';
      toast.error(t('studyDetail.dicomDirFailed', { defaultValue: 'DICOM-DIR download failed' }) + ref);
    },
  });

  // Update tab label with patient name when loaded
  useTabLabel(study ? formatPatientName(study.patientName) : undefined);

  // ── Series filtering + sorting ──
  type SortKey = 'seriesNumber' | 'modality' | 'seriesDescription' | 'numberOfInstances';
  const filteredSortedSeries = useMemo(() => {
    let result = [...series];
    // Search filter
    if (seriesSearch.trim()) {
      const q = seriesSearch.toLowerCase();
      result = result.filter((s) =>
        s.seriesDescription?.toLowerCase().includes(q) ||
        s.modality.toLowerCase().includes(q) ||
        String(s.seriesNumber).includes(q) ||
        s.seriesInstanceUID.toLowerCase().includes(q)
      );
    }
    // Sort
    result.sort((a, b) => {
      const dir = seriesSort.dir === 'asc' ? 1 : -1;
      switch (seriesSort.key) {
        case 'seriesNumber':
          return (a.seriesNumber - b.seriesNumber) * dir;
        case 'modality':
          return a.modality.localeCompare(b.modality) * dir;
        case 'seriesDescription':
          return (a.seriesDescription ?? '').localeCompare(b.seriesDescription ?? '') * dir;
        case 'numberOfInstances':
          return (a.numberOfInstances - b.numberOfInstances) * dir;
        default:
          return 0;
      }
    });
    return result;
  }, [series, seriesSearch, seriesSort]);

  const toggleSort = (key: SortKey) => {
    setSeriesSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (seriesSort.key !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return seriesSort.dir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  // ── Multi-select series ──
  const allFilteredIds = filteredSortedSeries.map((s) => s.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedSeriesIds.has(id));
  const someSelected = selectedSeriesIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedSeriesIds(new Set());
    } else {
      setSelectedSeriesIds(new Set(allFilteredIds));
    }
  };

  const toggleSelectSeries = (id: string) => {
    setSelectedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk download selected series ──
  const handleBulkDownload = async () => {
    const ids = Array.from(selectedSeriesIds);
    if (ids.length === 0) return;
    setBulkDownloading(true);
    try {
      const blob = await toolsApi.createArchive(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatPatientName(study?.patientName ?? 'study')}_${ids.length}series.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      audit({
        action: 'download',
        title: `Bulk series download: ${ids.length} series from ${formatPatientName(study?.patientName ?? '')}`,
        resource: study?.studyInstanceUID ?? '',
        severity: 'info',
        metadata: { 'Study ID': studyId!, 'Series Count': String(ids.length), 'Series IDs': ids.join(', ') },
      });
      toast.success(t('study.bulkDownloadSuccess', { count: ids.length }));
      setSelectedSeriesIds(new Set());
    } catch (e) {
      const ref = e instanceof OrthancError ? ` (Ref: ${e.correlationId})` : '';
      toast.error(`${t('study.bulkDownloadFailed')}${ref}`);
    } finally {
      setBulkDownloading(false);
    }
  };

  // P0: Bulk delete selected series
  const handleBulkDeleteSeries = async () => {
    const ids = Array.from(selectedSeriesIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await deleteSeriesAction(id);
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedSeriesIds(new Set());
    if (ok > 0) toast.success(t('studyDetail.bulkDeleteSuccess', { count: ok, defaultValue: `${ok} series deleted` }));
    if (fail > 0) toast.error(t('studyDetail.bulkDeleteError', { count: fail, defaultValue: `${fail} series could not be deleted` }));
    queryClient.invalidateQueries({ queryKey: ['study', studyId] });
    queryClient.invalidateQueries({ queryKey: ['studies'] });
  };

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
        <p className="text-muted-foreground">{t('studies.notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/studies')}>{t('studies.backToList')}</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      {/* Screen-reader-only H1 for accessibility — visible title is the breadcrumb patient name */}
      <h1 className="sr-only">{formatPatientName(study.patientName)}</h1>
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
              // Set httpOnly cookie for OHIF/DICOMweb access (8h PACS token);
              // skipped in standalone deployments (viewerSession: false).
              await requestViewerSession();
              window.open(`/ohif/viewer?StudyInstanceUIDs=${study.studyInstanceUID}`, '_blank', 'noopener,noreferrer');
            }}
          >
            <Eye className="h-3.5 w-3.5" /> {t('actions.openInOhif')}
          </Button>
          {/* External Viewers: VolView, MedDream, Weasis (configurable in Settings) */}
          {(() => {
            const viewers = JSON.parse(localStorage.getItem('oe3-viewers') || '[]') as Array<{id: string; url: string; enabled: boolean; type: string}>;
            return viewers
              .filter((v) => v.enabled && v.url && v.id !== 'ohif' && v.id !== 'stone')
              .map((v) => (
                <Button
                  key={v.id}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 capitalize"
                  onClick={async () => {
                    // Set viewer session cookie first (no-op when viewerSession: false)
                    await requestViewerSession();
                    if (v.type === 'desktop') {
                      // Weasis uses custom protocol: weasis://$dicom:get -w "rsid:..." ...
                      window.location.href = `${v.url}$dicom:get -r "http://10.0.1.46:3080/api/v1/pacs/orthanc/wado-rs/studies/${study.studyInstanceUID}"`;
                    } else {
                      // Web viewers (VolView, MedDream) — pass study UID
                      const sep = v.url.includes('?') ? '&' : '?';
                      window.open(`${v.url}${sep}StudyInstanceUIDs=${study.studyInstanceUID}`, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {v.id}
                </Button>
              ));
          })()}
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
                  {downloadMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloadMutation.isPending ? t('studyDetail.preparingDownload', { defaultValue: 'Preparing...' }) : t('actions.download')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('studyDetail.downloadTooltip', { defaultValue: 'Download as DICOM ZIP archive' })}</TooltipContent>
            </Tooltip>
          )}
          {canDownload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={downloadDicomDirMutation.isPending}
                  onClick={() => {
                    audit({ action: 'download', title: `Study DICOM-DIR downloaded: ${formatPatientName(study.patientName)}`, resource: study.studyInstanceUID, severity: 'info', metadata: { 'Study ID': studyId!, 'Format': 'DICOM-DIR ZIP' } });
                    downloadDicomDirMutation.mutate(studyId!);
                  }}
                >
                  {downloadDicomDirMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FolderArchive className="h-3.5 w-3.5" />
                  )}
                  {downloadDicomDirMutation.isPending ? t('studyDetail.preparingDicomDir', { defaultValue: 'Preparing DICOM-DIR...' }) : t('studyDetail.dicomDir', { defaultValue: 'DICOM-DIR' })}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('studyDetail.dicomDirTooltip', { defaultValue: 'Download as ZIP with DICOMDIR index' })}</TooltipContent>
            </Tooltip>
          )}
          {canSend && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSendOpen(true)}><Send className="h-3.5 w-3.5" /> {t('actions.send')}</Button>
          )}
          {canModify && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModifyOpen(true)}><Pencil className="h-3.5 w-3.5" /> {t('actions.modify')}</Button>
          )}
          {canModify && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMigrateOpen(true)}><GitMerge className="h-3.5 w-3.5" /> {t('migrate.title')}</Button>
          )}
          {canAnonymize && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAnonOpen(true)}><Shield className="h-3.5 w-3.5" /> {t('actions.anonymize')}</Button>
          )}
          {/* ApiView — open the Orthanc REST API URL for this study in a new tab */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const orthancUrl = getConfig().orthancUrl;
              window.open(`${orthancUrl}/studies/${studyId}`, '_blank');
            }}
          >
            <Code className="h-3.5 w-3.5" /> {t('studyDetail.apiView', { defaultValue: 'API' })}
          </Button>
          {/* Share Study — create shareable link */}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5" /> {t('actions.share', { defaultValue: 'Share' })}
          </Button>
          {/* Custom Buttons (configurable via Settings) */}
          {(() => {
            const buttons = loadCustomButtons().filter((b) => !b.level || b.level === 'study');
            return buttons.map((btn) => (
              <Button
                key={btn.id}
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  executeButton(btn, {
                    studyId: studyId!,
                    studyInstanceUID: study.studyInstanceUID,
                    patientId: study.patientId,
                    patientName: study.patientName,
                    accessionNumber: study.accessionNumber,
                  }).catch((e) => toast.error(`Custom button failed: ${e.message}`));
                }}
              >
                {btn.label}
              </Button>
            ));
          })()}
          {/* Add Series (PDF/Image/STL) */}
          {canModify && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddSeriesOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {t('study.addSeries', { defaultValue: 'Add Series' })}
            </Button>
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
                    {t('study.deleteConfirmPrefix')} <strong>{formatPatientName(study.patientName)}</strong> {t('study.deleteConfirmSuffix', { series: study.numberOfSeries, instances: study.numberOfInstances })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                    audit({ action: 'delete', title: `Study deleted: ${formatPatientName(study.patientName)}`, resource: study.studyInstanceUID, severity: 'warning', metadata: { 'Study ID': studyId!, 'Series': String(study.numberOfSeries), 'Instances': String(study.numberOfInstances) } });
                    deleteMutation.mutate(studyId!);
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('study.patient')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-lg font-semibold">{formatPatientName(study.patientName)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">{t('studyDetail.patientId', { defaultValue: 'Patient ID' })}</span>
                    <span className="font-mono text-xs">{study.patientId}</span>
                    {study.patientBirthDate && (
                      <>
                        <span className="text-muted-foreground">{t('studyDetail.birthDate', { defaultValue: 'Birth Date' })}</span>
                        <span>{format(study.patientBirthDate, 'MMM dd, yyyy')}</span>
                      </>
                    )}
                    {study.patientSex && (
                      <>
                        <span className="text-muted-foreground">{t('studyDetail.sex', { defaultValue: 'Sex' })}</span>
                        <span>
                          {study.patientSex === 'M'
                            ? t('studyDetail.sexMale', { defaultValue: 'Male' })
                            : study.patientSex === 'F'
                              ? t('studyDetail.sexFemale', { defaultValue: 'Female' })
                              : t('studyDetail.sexOther', { defaultValue: 'Other' })}
                        </span>
                      </>
                    )}
                  </div>
                  {/* P0.4: Same patient studies link — navigate to study list filtered by PatientID */}
                  <a
                    href={`/oe3/studies?patientId=${encodeURIComponent(study.patientId)}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                  >
                    <BookOpen className="h-3 w-3" />
                    {t('studyDetail.samePatientStudies', { defaultValue: 'Show all studies for this patient' })}
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('studyDetail.studyInfo', { defaultValue: 'Study Info' })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">{t('studies.studyDate', { defaultValue: 'Study Date' })}</span>
                    <span>{format(study.studyDate, 'MMM dd, yyyy')}</span>
                    {study.studyTime && (
                      <>
                        <span className="text-muted-foreground">{t('quickReport.studyTime', { defaultValue: 'Study Time' })}</span>
                        <span>{study.studyTime}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">{t('studies.description', { defaultValue: 'Description' })}</span>
                    <span>{study.studyDescription || '—'}</span>
                    <span className="text-muted-foreground">{t('studyList.columns.accession', { defaultValue: 'Accession #' })}</span>
                    <span className="font-mono text-xs">{study.accessionNumber}</span>
                    <span className="text-muted-foreground">{t('studies.modality', { defaultValue: 'Modality' })}</span>
                    <div className="flex gap-1">
                      {study.modalities.map((m) => <ModalityBadge key={m} modality={m} />)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('studyDetail.statistics', { defaultValue: 'Statistics' })}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-muted">
                      <Layers className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{study.numberOfSeries}</div>
                      <div className="text-xs text-muted-foreground">{t('studies.series', { defaultValue: 'Series' })}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <Image className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{study.numberOfInstances ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{t('studyDetail.images', { defaultValue: 'Images' })}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <HardDrive className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-semibold">{formatDiskSize(study.diskSize)}</div>
                      <div className="text-xs text-muted-foreground">{t('common.size', { defaultValue: 'Size' })}</div>
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
                  <div className="flex items-center justify-between gap-2 flex-col sm:flex-row">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Series ({series.length})</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:flex-nowrap">
                      {seriesView === 'table' && (
                        <div className="relative flex-1 sm:w-48">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Filter series…"
                            aria-label="Filter series"
                            value={seriesSearch}
                            onChange={(e) => setSeriesSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                          />
                        </div>
                      )}
                      <ToggleGroup type="single" value={seriesView} onValueChange={(v) => v && setSeriesView(v as 'grid' | 'table')} size="sm">
                        <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
                        <ToggleGroupItem value="table" aria-label="Table view"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
                      </ToggleGroup>
                      <div className="relative" ref={seriesColConfigRef}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSeriesColumnConfig((p) => !p)}
                          className="gap-1.5"
                          aria-expanded={showSeriesColumnConfig}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('studyList.columns.config')}</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${showSeriesColumnConfig ? 'rotate-180' : ''}`} />
                        </Button>
                        {showSeriesColumnConfig && (
                          <div data-col-config-open className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-3 min-w-[200px]">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              {t('studyList.columns.toggle')}
                            </p>
                            <div className="space-y-1">
                              {[
                                { id: 'seriesNumber', label: t('quickReport.seriesNumber', { defaultValue: '#' }) },
                                { id: 'modality', label: t('studies.modality', { defaultValue: 'Modality' }) },
                                { id: 'seriesDescription', label: t('studies.description', { defaultValue: 'Description' }) },
                                { id: 'numberOfInstances', label: t('studyDetail.images', { defaultValue: 'Images' }) },
                                { id: 'seriesInstanceUID', label: t('studyDetail.seriesInstanceUID', { defaultValue: 'Series Instance UID' }) },
                              ].map((col) => (
                                <label
                                  key={col.id}
                                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                                >
                                  <Checkbox
                                    checked={seriesColumnVisibility[col.id]}
                                    onCheckedChange={(v) =>
                                      setSeriesColumnVisibility((prev) => ({ ...prev, [col.id]: !!v }))
                                    }
                                  />
                                  <span>{col.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isMobile && (
                    /* Mobile sort bar — same pattern as the studies list;
                       the table-header sorting is not reachable on cards */
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={seriesSort.key}
                        onValueChange={(k) => setSeriesSort({ key: k as SortKey, dir: seriesSort.dir })}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs" aria-label={t('studyDetail.sortBy', { defaultValue: 'Sort by' })}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seriesNumber">{t('quickReport.seriesNumber', { defaultValue: '#' })}</SelectItem>
                          <SelectItem value="modality">{t('studies.modality', { defaultValue: 'Modality' })}</SelectItem>
                          <SelectItem value="seriesDescription">{t('studies.description', { defaultValue: 'Description' })}</SelectItem>
                          <SelectItem value="numberOfInstances">{t('studyDetail.images', { defaultValue: 'Images' })}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => setSeriesSort((p) => ({ ...p, dir: p.dir === 'asc' ? 'desc' : 'asc' }))}
                        aria-label={seriesSort.dir === 'asc' ? t('studyList.sortAsc', { defaultValue: 'Ascending' }) : t('studyList.sortDesc', { defaultValue: 'Descending' })}
                      >
                        {seriesSort.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                  {seriesView === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredSortedSeries.map((s) => (
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
                    <>
                      {/* Bulk action bar */}
                      {selectedSeriesIds.size > 0 && (
                        <div className="flex items-center justify-between gap-2 mb-3 p-2 rounded-md bg-primary/5 border border-primary/20 flex-col sm:flex-row">
                          <span className="text-sm font-medium">
                            {selectedSeriesIds.size} series selected
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={bulkDownloading}
                              onClick={handleBulkDownload}
                            >
                              {bulkDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              Download {selectedSeriesIds.size} as ZIP
                            </Button>
                            {canSend && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setBulkSendOpen(true)}
                              >
                                <Send className="h-3.5 w-3.5" /> {t('studyDetail.bulkSend', { defaultValue: 'Send' })}
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-destructive"
                                onClick={() => setBulkDeleteOpen(true)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> {t('studyDetail.bulkDelete', { defaultValue: 'Delete' })}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSeriesIds(new Set())}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      )}
                      {isMobile ? (
                        /* ── Mobile Series Card View ── */
                        <div className="divide-y">
                          {filteredSortedSeries.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-sm">
                              No series match "{seriesSearch}"
                            </div>
                          ) : (
                            filteredSortedSeries.map((s) => {
                              const isSelected = selectedSeriesIds.has(s.id);
                              return (
                                <div
                                  key={s.id}
                                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                                  onClick={() => navigate(`/studies/${studyId}/series/${s.id}`)}
                                >
                                  <div className="flex items-center gap-2">
                                    {seriesColumnVisibility.select && (
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleSelectSeries(s.id)}
                                        aria-label={`Select series ${s.seriesNumber}`}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                    {seriesColumnVisibility.seriesNumber && (
                                      <span className="font-medium text-sm">#{s.seriesNumber}</span>
                                    )}
                                    {seriesColumnVisibility.modality && (
                                      <ModalityBadge modality={s.modality} />
                                    )}
                                    {seriesColumnVisibility.numberOfInstances && (
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {s.numberOfInstances} img
                                      </span>
                                    )}
                                  </div>
                                  {seriesColumnVisibility.seriesDescription && s.seriesDescription && (
                                    <div className="mt-1.5 text-xs text-muted-foreground pl-7">
                                      {s.seriesDescription}
                                    </div>
                                  )}
                                  {seriesColumnVisibility.seriesInstanceUID && (
                                    <div className="mt-1 text-[10px] font-mono text-muted-foreground pl-7 truncate">
                                      {s.seriesInstanceUID}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        /* ── Desktop Series Table ── */
                        <div className="overflow-auto">
                          <Table style={{ minWidth: '700px' }}>
                            <TableHeader>
                              <TableRow>
                                {seriesColumnVisibility.select && (
                                  <TableHead className="w-10">
                                    <Checkbox
                                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                      onCheckedChange={toggleSelectAll}
                                      aria-label="Select all series"
                                    />
                                  </TableHead>
                                )}
                                {seriesColumnVisibility.seriesNumber && (
                                  <TableHead className="cursor-pointer select-none w-16" onClick={() => toggleSort('seriesNumber')}>
                                    {t('quickReport.seriesNumber', { defaultValue: '#' })}<SortIcon col="seriesNumber" />
                                  </TableHead>
                                )}
                                {seriesColumnVisibility.modality && (
                                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('modality')}>
                                    {t('studies.modality', { defaultValue: 'Modality' })}<SortIcon col="modality" />
                                  </TableHead>
                                )}
                                {seriesColumnVisibility.seriesDescription && (
                                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('seriesDescription')}>
                                    {t('studies.description', { defaultValue: 'Description' })}<SortIcon col="seriesDescription" />
                                  </TableHead>
                                )}
                                {seriesColumnVisibility.numberOfInstances && (
                                  <TableHead className="cursor-pointer select-none w-24" onClick={() => toggleSort('numberOfInstances')}>
                                    {t('studyDetail.images', { defaultValue: 'Images' })}<SortIcon col="numberOfInstances" />
                                  </TableHead>
                                )}
                                {seriesColumnVisibility.seriesInstanceUID && (
                                  <TableHead>{t('studyDetail.seriesInstanceUID', { defaultValue: 'Series Instance UID' })}</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredSortedSeries.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={Object.values(seriesColumnVisibility).filter(Boolean).length} className="text-center text-muted-foreground py-8">
                                    No series match "{seriesSearch}"
                                  </TableCell>
                                </TableRow>
                              ) : (
                                filteredSortedSeries.map((s) => {
                                  const isSelected = selectedSeriesIds.has(s.id);
                                  return (
                                    <TableRow
                                      key={s.id}
                                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                                      onClick={() => navigate(`/studies/${studyId}/series/${s.id}`)}
                                    >
                                      {seriesColumnVisibility.select && (
                                        <TableCell onClick={(e) => { e.stopPropagation(); toggleSelectSeries(s.id); }}>
                                          <Checkbox checked={isSelected} aria-label={`Select series ${s.seriesNumber}`} />
                                        </TableCell>
                                      )}
                                      {seriesColumnVisibility.seriesNumber && (
                                        <TableCell className="font-medium">{s.seriesNumber}</TableCell>
                                      )}
                                      {seriesColumnVisibility.modality && (
                                        <TableCell><ModalityBadge modality={s.modality} /></TableCell>
                                      )}
                                      {seriesColumnVisibility.seriesDescription && (
                                        <TableCell className="text-sm">{s.seriesDescription || '—'}</TableCell>
                                      )}
                                      {seriesColumnVisibility.numberOfInstances && (
                                        <TableCell className="text-sm text-muted-foreground">{s.numberOfInstances}</TableCell>
                                      )}
                                      {seriesColumnVisibility.seriesInstanceUID && (
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
                                      )}
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </>
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
              {sharedTags ? (
                <DicomTagBrowser study={study} tags={sharedTags} />
              ) : (
                <p className="text-center text-muted-foreground text-sm py-8 animate-pulse">
                  {t('dicomTagBrowser.loading') || 'Loading tags…'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              <StudyActivityLog studyId={studyId} studyInstanceUid={study?.studyInstanceUID} />
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
      {study && sharedTags && (
        <ModifyStudyDialog
          open={modifyOpen}
          onOpenChange={setModifyOpen}
          study={study}
          instanceCount={study.numberOfInstances}
          tags={sharedTags}
        />
      )}
      {study && (
        <MigrateStudyDialog
          open={migrateOpen}
          onOpenChange={setMigrateOpen}
          targetStudy={study}
        />
      )}

      {/* Bulk Send Series Dialog */}
      {study && (
        <SendStudyDialog
          open={bulkSendOpen}
          onOpenChange={setBulkSendOpen}
          studies={Array.from(selectedSeriesIds).map((sid) => ({
            id: sid,
            patientName: formatPatientName(study.patientName),
            studyDescription: `${study.studyDescription} (series)`,
          }))}
        />
      )}

      {/* Bulk Delete Series Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('studyDetail.bulkDeleteTitle', { defaultValue: 'Delete selected series?' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('studyDetail.bulkDeleteConfirm', {
                count: selectedSeriesIds.size,
                defaultValue: `You are about to permanently delete ${selectedSeriesIds.size} series. This action cannot be undone.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{t('common.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteSeries}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('studyDetail.bulkDelete', { defaultValue: 'Delete' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Study Dialog */}
      {study && (
        <ShareStudyDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          studyId={study.id}
          studyInstanceUID={study.studyInstanceUID}
          patientName={formatPatientName(study.patientName)}
        />
      )}

      {/* Add Series Dialog (PDF/Image/STL) */}
      {study && (
        <AddSeriesDialog
          open={addSeriesOpen}
          onOpenChange={setAddSeriesOpen}
          studyId={study.id}
          studyInstanceUid={study.studyInstanceUID}
          patientId={study.patientId}
          patientName={study.patientName}
        />
      )}
    </div>
  );
}
