import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
  Upload,
  Send,
  ShieldCheck,
  Trash2,
  Pencil,
  Tag,
  Download,
  Radio,
  Server,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Filter,
  Search,
  Clock,
  X,
  FileDown,
  CalendarIcon,
  Loader2,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useChanges } from '@/features/activity/hooks/useChanges';
import { useOrthancJobs } from '@/features/activity/hooks/useOrthancJobs';
import type { Change } from '@/api/changes';
import type { OrthancJob } from '@/api/jobs';
import { useJobStore } from '@/store/job-store';
import { useAuditStore } from '@/store/audit-store';
import { ActivityEvent, ActivityCategory, ActivitySeverity } from '@/shared/types/activity';
import { ActivityDetailPanel } from '@/features/activity/components/ActivityDetailPanel';
import { useActivityUIStore } from '@/store/activity-ui-store';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  upload: <Upload className="h-3.5 w-3.5" />,
  send: <Send className="h-3.5 w-3.5" />,
  anonymize: <ShieldCheck className="h-3.5 w-3.5" />,
  delete: <Trash2 className="h-3.5 w-3.5" />,
  modify: <Pencil className="h-3.5 w-3.5" />,
  label: <Tag className="h-3.5 w-3.5" />,
  download: <Download className="h-3.5 w-3.5" />,
  echo: <Radio className="h-3.5 w-3.5" />,
  system: <Server className="h-3.5 w-3.5" />,
  move: <Download className="h-3.5 w-3.5" />,
  archive: <Download className="h-3.5 w-3.5" />,
  transcode: <Server className="h-3.5 w-3.5" />,
  split: <Pencil className="h-3.5 w-3.5" />,
  merge: <Pencil className="h-3.5 w-3.5" />,
};

const SEVERITY_ICON: Record<ActivitySeverity, React.ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  info: <Info className="h-3.5 w-3.5 text-info" />,
};

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  job: 'bg-primary/10 text-primary border-primary/20',
  audit: 'bg-accent/10 text-accent border-accent/20',
  log: 'bg-muted text-muted-foreground border-border',
};

// Orthanc job type → action mapping (REAL Orthanc 1.13.0 type names)
const JOB_TYPE_MAP: Record<string, string> = {
  'DicomStoreScu': 'send',
  'DicomMoveScu': 'move',
  'ResourceModification': 'modify', // may be overridden to 'anonymize' if IsAnonymization
  'Archive': 'archive',
  'Media': 'download',
  'SplitInstance': 'split',
  'Merge': 'merge',
  'Transcode': 'transcode',
  'DicomWeb': 'system',
};

// Orthanc job type → i18n label key suffix
const JOB_TYPE_LABEL_MAP: Record<string, string> = {
  'DicomStoreScu': 'store',
  'DicomMoveScu': 'move',
  'ResourceModification': 'modify',
  'Archive': 'archive',
  'Media': 'media',
  'SplitInstance': 'split',
  'Merge': 'merge',
  'Transcode': 'transcode',
  'DicomWeb': 'dicomweb',
};

// DICOM tag group/element → human-readable name (for DicomMoveScu Query extraction)
const DICOM_TAG_NAMES: Record<string, string> = {
  '0010,0010': 'PatientName',
  '0010,0020': 'PatientID',
  '0010,0030': 'PatientBirthDate',
  '0010,0040': 'PatientSex',
  '0008,0050': 'AccessionNumber',
  '0008,0061': 'ModalitiesInStudy',
  '0008,1030': 'StudyDescription',
  '0020,000d': 'StudyInstanceUID',
  '0020,000e': 'SeriesInstanceUID',
};

function parseOrthancDate(dateStr?: string): number {
  if (!dateStr) return 0;
  // Orthanc format: "20240101T120000,123456" (boost::posix_time ISO with microseconds)
  // Also tolerate "20240101T120000" (no fraction) and "." as fraction separator
  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:[.,]\d+)?/);
  if (!m) return 0;
  return new Date(
    parseInt(m[1]),
    parseInt(m[2]) - 1,
    parseInt(m[3]),
    parseInt(m[4]),
    parseInt(m[5]),
    parseInt(m[6]),
  ).getTime();
}

/** Formats a DICOM PatientName ("LAST^FIRST^MIDDLE") into readable form. */
function formatDicomPatientName(raw: string): string {
  if (!raw) return raw;
  const parts = raw.split('^');
  if (parts.length < 2) return raw.trim();
  const last = parts[0]?.trim() ?? '';
  const first = parts[1]?.trim() ?? '';
  return first ? `${first} ${last}` : last;
}

function changeToActivity(change: Change, t: (key: string, opts?: any) => string): ActivityEvent {
  const changeTypeMap: Record<string, string> = {
    NewStudy: 'upload',
    NewSeries: 'upload',
    NewInstance: 'upload',
    NewPatient: 'upload',
    StableStudy: 'system',
    StableSeries: 'system',
    StableInstance: 'system',
    DeletionStudy: 'delete',
    DeletionSeries: 'delete',
    DeletionInstance: 'delete',
  };

  const action = changeTypeMap[change.ChangeType] ?? 'system';
  const ts = parseOrthancDate(change.Date) || Date.now();

  // i18n the change type
  const changeTypeKey = `activity.changeTypes.${change.ChangeType}`;
  const changeTypeLabel = t(changeTypeKey);
  const resourceTypeLabel = t(`activity.resourceTypes.${change.ResourceType}`, {
    defaultValue: change.ResourceType,
  });

  return {
    id: `change-${change.Seq}`,
    timestamp: ts,
    category: 'log',
    severity: change.ChangeType.startsWith('Deletion') ? 'warning' : 'info',
    title: `${changeTypeLabel}: ${resourceTypeLabel} ${change.ID.substring(0, 12)}`,
    action,
    resource: change.Path,
    metadata: {
      [t('activity.metadata.resourceType')]: change.ResourceType,
      [t('activity.metadata.resourceId')]: change.ID,
      [t('activity.metadata.sequence')]: String(change.Seq),
    },
  };
}

function orthancJobToActivity(
  job: OrthancJob,
  t: (key: string, opts?: any) => string,
): ActivityEvent {
  const content = (job.Content || {}) as Record<string, unknown>;

  // ResourceModification can be either modify OR anonymize
  const isAnonymization = content['IsAnonymization'] === true;
  let action = JOB_TYPE_MAP[job.Type] ?? 'system';
  let typeLabelKey = JOB_TYPE_LABEL_MAP[job.Type] ?? 'system';
  if (job.Type === 'ResourceModification' && isAnonymization) {
    action = 'anonymize';
    typeLabelKey = 'anonymize';
  }
  const typeLabel = t(`activity.jobTypes.${typeLabelKey}`, { defaultValue: job.Type });

  const stateMap: Record<string, ActivitySeverity> = {
    Success: 'success',
    Failure: 'error',
    Running: 'info',
    Pending: 'info',
    Paused: 'warning',
    Retry: 'warning',
  };
  const severity = stateMap[job.State] ?? 'info';

  const createdAt = parseOrthancDate(job.CreationTime) || Date.now();

  // Duration: prefer Orthanc's EffectiveRuntime (seconds) — it's authoritative
  // Fall back to CreationTime→CompletionTime for older jobs
  const effectiveRuntime = typeof (job as any).EffectiveRuntime === 'number'
    ? (job as any).EffectiveRuntime
    : undefined;
  const completedAt = parseOrthancDate(job.CompletionTime);
  const isDone = job.State === 'Success' || job.State === 'Failure';
  const duration = effectiveRuntime !== undefined
    ? Math.round(effectiveRuntime * 1000)
    : isDone && completedAt && completedAt > createdAt
      ? completedAt - createdAt
      : job.State === 'Running'
        ? Date.now() - createdAt
        : undefined;

  const stateLabel = t(`activity.jobStates.${job.State.toLowerCase()}`, {
    defaultValue: job.State,
  });

  // Actor: Content.Description tells us who triggered it
  // "REST API" = user via web UI; modality AET = system/DICOM
  const description = str(content['Description']);
  const actor = description === 'REST API'
    ? t('activity.actor.webUi')
    : description === 'Lua'
      ? t('activity.actor.luaScript')
      : description === 'system'
        ? t('activity.actor.system')
        : description || undefined;

  // Extract patient/study info — different job types store it differently
  // DicomMoveScu: Content.Query[0] uses DICOM tag format ("0010,0020")
  // ResourceModification: Content.PatientID (plaintext), Content.Resources
  // Archive: Content.InstancesCount only
  const queryList = Array.isArray(content['Query'])
    ? (content['Query'] as Record<string, unknown>[])
    : [];
  const query0 = queryList.length > 0 ? queryList[0] : {};
  // Convert DICOM tag keys to readable names
  const queryTranslated: Record<string, string> = {};
  for (const [tag, val] of Object.entries(query0)) {
    const name = DICOM_TAG_NAMES[tag] || tag;
    queryTranslated[name] = String(val);
  }

  const patientId =
    str(content['PatientID']) || queryTranslated['PatientID'];
  const patientName = queryTranslated['PatientName'];
  const accessionNumber = queryTranslated['AccessionNumber'];
  const studyDescription = str(content['StudyDescription']) || queryTranslated['StudyDescription'];
  const studyInstanceUid = queryTranslated['StudyInstanceUID'];
  const remoteAet = str(content['RemoteAet']);
  const localAet = str(content['LocalAet']);
  const targetAet = str(content['TargetAet']);
  const instancesCount = typeof content['InstancesCount'] === 'number'
    ? content['InstancesCount'] as number
    : undefined;
  const failedInstancesCount = typeof content['FailedInstancesCount'] === 'number'
    ? content['FailedInstancesCount'] as number
    : undefined;
  const parentResources = Array.isArray(content['ParentResources'])
    ? content['ParentResources'] as string[]
    : [];
  const resources = Array.isArray(content['Resources'])
    ? content['Resources'] as Record<string, unknown>[]
    : [];
  const archiveSizeMB = typeof content['ArchiveSizeMB'] === 'number'
    ? content['ArchiveSizeMB'] as number
    : undefined;
  const details = Array.isArray(content['Details'])
    ? content['Details'] as Record<string, unknown>[]
    : [];
  // Count received instances across all Details entries
  const totalReceivedInstances = details.reduce((sum, d) => {
    const ids = d['ReceivedInstancesIds'];
    return sum + (Array.isArray(ids) ? ids.length : 0);
  }, 0);

  // Build a type-specific, human-readable summary
  const contextLabel = (() => {
    switch (job.Type) {
      case 'DicomStoreScu': {
        const target = targetAet || remoteAet || '?';
        return patientName || patientId
          ? t('activity.jobContext.storeWithPatient', {
              target,
              patient: patientName ? formatDicomPatientName(patientName) : patientId!,
              id: patientId || accessionNumber || '—',
            })
          : t('activity.jobContext.store', { target });
      }
      case 'DicomMoveScu': {
        const source = remoteAet || '?';
        const patient = patientName ? formatDicomPatientName(patientName) : patientId || accessionNumber;
        return patient
          ? t('activity.jobContext.moveWithPatient', {
              source,
              patient,
              id: patientId || accessionNumber || '—',
              count: totalReceivedInstances || 1,
            })
          : t('activity.jobContext.move', { source, count: totalReceivedInstances || 0 });
      }
      case 'ResourceModification': {
        if (isAnonymization) {
          return t('activity.jobContext.anonymize', {
            patient: patientId || studyDescription || parentResources[0]?.substring(0, 12) || 'resource',
            count: instancesCount ?? 0,
          });
        }
        return t('activity.jobContext.modify', {
          patient: patientId || studyDescription || parentResources[0]?.substring(0, 12) || 'resource',
          count: instancesCount ?? 0,
        });
      }
      case 'Archive': {
        return t('activity.jobContext.archive', {
          count: instancesCount ?? 0,
          size: archiveSizeMB !== undefined ? `${archiveSizeMB} MB` : '',
        });
      }
      case 'Media': {
        return t('activity.jobContext.media', { count: instancesCount ?? 0 });
      }
      case 'Merge': {
        return t('activity.jobContext.merge', { count: resources.length });
      }
      case 'SplitInstance': {
        return t('activity.jobContext.split');
      }
      default:
        return description || '';
    }
  })();

  const title =
    job.State === 'Running'
      ? `${typeLabel} — ${stateLabel} (${job.Progress}%)${contextLabel ? ` · ${contextLabel}` : ''}`
      : `${typeLabel} — ${stateLabel}${contextLabel ? ` · ${contextLabel}` : ''}`;

  const metadata: Record<string, string> = {
    [t('activity.metadata.jobId')]: job.ID,
    [t('activity.metadata.state')]: job.State,
    [t('activity.metadata.progress')]: `${job.Progress}%`,
    [t('activity.metadata.jobType')]: job.Type,
  };

  if (actor) metadata[t('activity.metadata.actor')] = actor;
  if (patientName) metadata[t('activity.metadata.patientName')] = formatDicomPatientName(patientName);
  if (patientId) metadata[t('activity.metadata.patientId')] = patientId;
  if (accessionNumber) metadata[t('activity.metadata.accessionNumber')] = accessionNumber;
  if (studyDescription) metadata[t('activity.metadata.studyDescription')] = studyDescription;
  if (studyInstanceUid) metadata[t('activity.metadata.studyInstanceUid')] = studyInstanceUid;
  if (remoteAet) metadata[t('activity.metadata.remoteAet')] = remoteAet;
  if (localAet) metadata[t('activity.metadata.localAet')] = localAet;
  if (targetAet) metadata[t('activity.metadata.targetAet')] = targetAet;
  if (instancesCount !== undefined) metadata[t('activity.metadata.instancesCount')] = String(instancesCount);
  if (failedInstancesCount !== undefined && failedInstancesCount > 0)
    metadata[t('activity.metadata.failedInstances')] = String(failedInstancesCount);
  if (totalReceivedInstances > 0) metadata[t('activity.metadata.receivedInstances')] = String(totalReceivedInstances);
  if (archiveSizeMB !== undefined) metadata[t('activity.metadata.archiveSize')] = `${archiveSizeMB} MB`;
  if (parentResources.length > 0) metadata[t('activity.metadata.parentResources')] = parentResources.join(', ');
  if (description) metadata[t('activity.metadata.description')] = description;
  // Store full Content as JSON for the detail panel "raw data" view
  metadata['__rawContent'] = JSON.stringify(content, null, 2);

  return {
    id: `orthanc-job-${job.ID}`,
    timestamp: createdAt,
    category: 'job',
    severity,
    title,
    action,
    actor,
    description: job.ErrorMessage || contextLabel || undefined,
    duration,
    metadata,
  };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function jobToActivity(job: import('@/shared/types/job').Job, t: (key: string, opts?: any) => string): ActivityEvent {
  const statusLabel = t(`activity.jobStates.${job.status}`, { defaultValue: job.status });
  const typeLabel = t(`activity.jobTypes.${job.type}`, { defaultValue: job.type });
  return {
    id: job.id,
    timestamp: job.updatedAt,
    category: 'job',
    severity:
      job.status === 'complete'
        ? 'success'
        : job.status === 'error' || job.status === 'interrupted'
          ? 'error'
          : job.status === 'running'
            ? 'info'
            : 'info',
    title: `${typeLabel} — ${statusLabel}: ${job.label}`,
    action: job.type,
    description: job.error || job.description,
    duration:
      job.status === 'complete' || job.status === 'error'
        ? job.updatedAt - job.createdAt
        : undefined,
    metadata: {
      [t('activity.metadata.jobId')]: job.id,
      [t('activity.metadata.state')]: job.status,
      ...(job.totalItems ? { [t('activity.metadata.totalItems')]: String(job.totalItems) } : {}),
      ...(job.completedItems ? { [t('activity.metadata.completedItems')]: String(job.completedItems) } : {}),
    },
  };
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatRelativeTime(ts: number, t: (key: string, options?: any) => string): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return t('activity.relativeTime.justNow');
  if (seconds < 3600) return t('activity.relativeTime.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('activity.relativeTime.hoursAgo', { count: Math.floor(seconds / 3600) });
  if (seconds < 86400 * 7) return t('activity.relativeTime.daysAgo', { count: Math.floor(seconds / 86400) });
  return format(new Date(ts), 'MMM d, HH:mm');
}

export default function ActivityPage() {
  const { t } = useTranslation();
  const { jobs: clientJobs } = useJobStore();
  const { events: liveAuditEvents } = useAuditStore();
  const { pendingSelectId, setPendingSelectId } = useActivityUIStore();
  const { data: changesData } = useChanges();
  const { data: orthancJobs = [] } = useOrthancJobs();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('job');
  const [myJobsOnly, setMyJobsOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  // Merge: Orthanc jobs + client-side jobs + live audit events + changes feed
  const allEvents = useMemo(() => {
    const changeEvents = (changesData?.Changes ?? []).map((c) => changeToActivity(c, t));
    const orthancJobEvents = orthancJobs.map((j) => orthancJobToActivity(j, t));
    const clientJobEvents = clientJobs.map((j) => jobToActivity(j, t));
    // Deduplicate: Orthanc jobs and client jobs may overlap by ID
    const seenIds = new Set<string>();
    const merged = [...liveAuditEvents, ...orthancJobEvents, ...clientJobEvents, ...changeEvents];
    const deduped = merged.filter((e) => {
      if (seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    });
    return deduped.sort((a, b) => b.timestamp - a.timestamp);
  }, [orthancJobs, clientJobs, liveAuditEvents, changesData, t]);

  // Auto-select event from Job Manager bar
  useEffect(() => {
    if (pendingSelectId && allEvents.length > 0) {
      const match = allEvents.find((e) => e.id === pendingSelectId);
      if (match) setSelectedEvent(match);
      setPendingSelectId(null);
    }
  }, [pendingSelectId, allEvents, setPendingSelectId]);

  const filtered = useMemo(() => {
    let result = allEvents;
    if (categoryFilter !== 'all') result = result.filter((e) => e.category === categoryFilter);
    // "My Jobs" filter — show only client-side jobs (uploads, downloads started from this browser)
    if (myJobsOnly) result = result.filter((e) => e.id.startsWith('client-'));
    if (severityFilter !== 'all') result = result.filter((e) => e.severity === severityFilter);
    if (dateFrom) result = result.filter((e) => e.timestamp >= startOfDay(dateFrom).getTime());
    if (dateTo) result = result.filter((e) => e.timestamp <= endOfDay(dateTo).getTime());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.resource?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [allEvents, categoryFilter, myJobsOnly, severityFilter, dateFrom, dateTo, search]);

  const counts = useMemo(
    () => ({
      total: allEvents.length,
      job: allEvents.filter((e) => e.category === 'job').length,
      audit: allEvents.filter((e) => e.category === 'audit').length,
      log: allEvents.filter((e) => e.category === 'log').length,
      errors: allEvents.filter((e) => e.severity === 'error').length,
    }),
    [allEvents],
  );

  const exportCsv = () => {
    const headers = [
      'Timestamp',
      'Category',
      'Severity',
      'Action',
      'Title',
      'Description',
      'Resource',
      'Actor',
      'Duration (ms)',
    ];
    const rows = filtered.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.category,
      e.severity,
      e.action,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.resource || '').replace(/"/g, '""')}"`,
      e.actor || '',
      e.duration ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryLabel = (cat: ActivityCategory) =>
    t(`activity.categoryLabels.${cat}`);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t('activity.subtitle')}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <FileDown className="h-3.5 w-3.5" /> {t('activity.exportCsv')}
          </Button>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Clock className="h-3 w-3" />
            {t('activity.events', { count: counts.total })}
          </Badge>
          <Badge
            variant="outline"
            className={cn('gap-1.5', categoryFilter === 'job' && 'border-primary bg-primary/5')}
          >
            <Upload className="h-3 w-3" />
            {t('activity.jobs', { count: counts.job })}
          </Badge>
          <Badge
            variant="outline"
            className={cn('gap-1.5', categoryFilter === 'audit' && 'border-accent bg-accent/5')}
          >
            <ShieldCheck className="h-3 w-3" />
            {t('activity.audit', { count: counts.audit })}
          </Badge>
          <Badge
            variant="outline"
            className={cn('gap-1.5', categoryFilter === 'log' && 'border-muted-foreground')}
          >
            <Server className="h-3 w-3" />
            {t('activity.system', { count: counts.log })}
          </Badge>
          {counts.errors > 0 && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {t('activity.errors', { count: counts.errors })}
            </Badge>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('activity.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {search && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 w-7 p-0"
                      onClick={() => setSearch('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Button
                  variant={myJobsOnly ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => setMyJobsOnly(!myJobsOnly)}
                >
                  <User className="h-3.5 w-3.5" />
                  {t('activity.myJobs', { defaultValue: 'My Jobs' })}
                </Button>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">{t('activity.job')}</SelectItem>
                    <SelectItem value="audit">{t('activity.auditLabel')}</SelectItem>
                    <SelectItem value="log">{t('activity.systemLabel')}</SelectItem>
                    <SelectItem value="all">{t('activity.allCategories')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activity.allSeverities')}</SelectItem>
                    <SelectItem value="success">{t('activity.severity.success')}</SelectItem>
                    <SelectItem value="info">{t('activity.severity.info')}</SelectItem>
                    <SelectItem value="warning">{t('activity.severity.warning')}</SelectItem>
                    <SelectItem value="error">{t('activity.severity.error')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-9 gap-1.5 text-sm', !dateFrom && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'MMM d, yyyy') : t('activity.from')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-9 gap-1.5 text-sm', !dateTo && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'MMM d, yyyy') : t('activity.to')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> {t('activity.clearDates')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-[140px]">{t('activity.colTime')}</TableHead>
                  <TableHead className="w-[80px]">{t('activity.colType')}</TableHead>
                  <TableHead>{t('activity.colEvent')}</TableHead>
                  <TableHead className="w-[100px] hidden md:table-cell">{t('activity.colDuration')}</TableHead>
                  <TableHead className="w-[80px] hidden lg:table-cell">{t('activity.colActor')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {t('activity.noEvents')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 200).map((event) => {
                    // Check if this is a running Orthanc job
                    const isRunningJob =
                      event.category === 'job' &&
                      event.metadata?.[t('activity.metadata.state')] === 'Running';
                    const progress = isRunningJob
                      ? parseInt(event.metadata?.[t('activity.metadata.progress')] || '0')
                      : null;

                    return (
                      <TableRow
                        key={event.id}
                        className={cn(
                          'group cursor-pointer transition-colors',
                          selectedEvent?.id === event.id && 'bg-muted',
                        )}
                        onClick={() =>
                          setSelectedEvent(selectedEvent?.id === event.id ? null : event)
                        }
                      >
                        <TableCell className="pr-0">
                          <div className="flex items-center gap-1.5">
                            {isRunningJob ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              SEVERITY_ICON[event.severity]
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">
                              {formatRelativeTime(event.timestamp, t)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(event.timestamp), 'HH:mm:ss')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] h-5 gap-1', CATEGORY_COLORS[event.category])}
                          >
                            {ACTION_ICONS[event.action] || <Info className="h-3 w-3" />}
                            {categoryLabel(event.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {event.description}
                              </p>
                            )}
                            {isRunningJob && progress !== null && (
                              <div className="mt-1 w-full max-w-[200px] h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDuration(event.duration)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{event.actor || '—'}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {filtered.length > 200 && (
              <div className="text-center py-3 text-xs text-muted-foreground border-t">
                {t('activity.showingOf', { shown: 200, total: filtered.length })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail panel */}
      {selectedEvent && (
        <ActivityDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
