import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Download, Send, Shield, Pencil, Upload, Eye, Trash2,
  AlertCircle, Clock, Info, CheckCircle2, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuditStore } from '@/store/audit-store';
import { useChanges } from '@/features/activity/hooks/useChanges';
import { useOrthancJobs } from '@/features/activity/hooks/useOrthancJobs';
import { normalizeResourceRefs } from '@/features/activity/lib/orthanc-resources';
import type { ActivityEvent } from '@/shared/types/activity';
import type { Change } from '@/api/changes';
import type { OrthancJob } from '@/api/jobs';

type TFn = ReturnType<typeof useTranslation>['t'];

const ACTION_ICONS: Record<string, React.ElementType> = {
  download: Download,
  send: Send,
  anonymize: Shield,
  modify: Pencil,
  upload: Upload,
  view: Eye,
  delete: Trash2,
  system: Clock,
  archive: Download,
  move: Send,
};

const SEVERITY_STYLES: Record<ActivityEvent['severity'], string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

const SEVERITY_BADGE: Record<ActivityEvent['severity'], string> = {
  info: 'bg-info/10 text-info border-info/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

function parseOrthancDate(dateStr?: string): number {
  if (!dateStr) return 0;
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

function formatRelative(ts: number, t: TFn) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return t('activity.relativeTime.justNow');
  if (seconds < 3600) return t('activity.relativeTime.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('activity.relativeTime.hoursAgo', { count: Math.floor(seconds / 3600) });
  if (seconds < 86400 * 7) return t('activity.relativeTime.daysAgo', { count: Math.floor(seconds / 86400) });
  return format(new Date(ts), 'MMM d, yyyy');
}

const CHANGE_TYPE_ACTION: Record<string, string> = {
  NewPatient: 'upload',
  NewStudy: 'upload',
  NewSeries: 'upload',
  NewInstance: 'upload',
  StablePatient: 'system',
  StableStudy: 'system',
  StableSeries: 'system',
  StableInstance: 'system',
  DeletionPatient: 'delete',
  DeletionStudy: 'delete',
  DeletionSeries: 'delete',
  DeletionInstance: 'delete',
};

function changeToActivity(change: Change, t: TFn): ActivityEvent {
  const action = CHANGE_TYPE_ACTION[change.ChangeType] ?? 'system';
  const ts = parseOrthancDate(change.Date) || Date.now();
  const changeTypeLabel = t(`activity.changeTypes.${change.ChangeType}`, { defaultValue: change.ChangeType });
  const resourceTypeLabel = t(`activity.resourceTypes.${change.ResourceType}`, { defaultValue: change.ResourceType });

  return {
    id: `change-${change.Seq}`,
    timestamp: ts,
    category: 'log',
    severity: change.ChangeType.startsWith('Deletion') ? 'warning' : 'info',
    title: `${changeTypeLabel}: ${resourceTypeLabel} ${change.ID.substring(0, 12)}`,
    action,
    resource: change.Path,
    metadata: {
      [t('activity.metadata.resourceType', { defaultValue: 'Resource Type' })]: change.ResourceType,
      [t('activity.metadata.resourceId', { defaultValue: 'Resource ID' })]: change.ID,
      [t('activity.metadata.sequence', { defaultValue: 'Sequence' })]: String(change.Seq),
    },
  };
}

const JOB_TYPE_MAP: Record<string, string> = {
  DicomStoreScu: 'send',
  DicomMoveScu: 'move',
  ResourceModification: 'modify',
  Archive: 'archive',
  Media: 'download',
  SplitInstance: 'modify',
  Merge: 'modify',
  Transcode: 'system',
  DicomWeb: 'system',
};

const JOB_TYPE_LABEL_MAP: Record<string, string> = {
  DicomStoreScu: 'store',
  DicomMoveScu: 'move',
  ResourceModification: 'modify',
  Archive: 'archive',
  Media: 'media',
  SplitInstance: 'split',
  Merge: 'merge',
  Transcode: 'transcode',
  DicomWeb: 'dicomweb',
};

const JOB_SEVERITY: Record<string, ActivityEvent['severity']> = {
  Success: 'success',
  Failure: 'error',
  Running: 'info',
  Pending: 'info',
  Paused: 'warning',
  Retry: 'warning',
};

function jobToActivity(job: OrthancJob, t: TFn): ActivityEvent {
  const content = job.Content ?? {};
  const isAnonymization = content['IsAnonymization'] === true;
  let action = JOB_TYPE_MAP[job.Type] ?? 'system';
  let typeLabelKey = JOB_TYPE_LABEL_MAP[job.Type] ?? 'system';
  if (job.Type === 'ResourceModification' && isAnonymization) {
    action = 'anonymize';
    typeLabelKey = 'anonymize';
  }

  const typeLabel = t(`activity.jobTypes.${typeLabelKey}`, { defaultValue: job.Type });
  const stateLabel = t(`activity.jobStates.${job.State.toLowerCase()}`, { defaultValue: job.State });
  const severity = JOB_SEVERITY[job.State] ?? 'info';
  const createdAt = parseOrthancDate(job.CreationTime) || Date.now();

  const description = typeof content['Description'] === 'string' ? content['Description'] : undefined;
  const actor =
    description === 'REST API'
      ? t('activity.actor.webUi', { defaultValue: 'Web UI' })
      : description === 'Lua'
        ? t('activity.actor.luaScript', { defaultValue: 'Lua' })
        : description === 'system'
          ? t('activity.actor.system', { defaultValue: 'System' })
          : description;

  const metadata: Record<string, string> = {
    [t('activity.metadata.jobId', { defaultValue: 'Job ID' })]: job.ID,
    [t('activity.metadata.state', { defaultValue: 'State' })]: job.State,
    [t('activity.metadata.progress', { defaultValue: 'Progress' })]: `${job.Progress}%`,
    [t('activity.metadata.jobType', { defaultValue: 'Job Type' })]: job.Type,
  };
  if (actor) metadata[t('activity.metadata.actor', { defaultValue: 'Actor' })] = actor;

  const title =
    job.State === 'Running'
      ? `${typeLabel} — ${stateLabel} (${job.Progress}%)`
      : `${typeLabel} — ${stateLabel}`;

  return {
    id: `orthanc-job-${job.ID}`,
    timestamp: createdAt,
    category: 'job',
    severity,
    title,
    action,
    actor,
    description: job.ErrorMessage || undefined,
    metadata,
  };
}

function isRelatedChange(change: Change, studyId: string, studyInstanceUid?: string): boolean {
  if (change.ID === studyId) return true;
  if (change.Path.includes(studyId)) return true;
  if (studyInstanceUid && (change.Path.includes(studyInstanceUid) || change.ID === studyInstanceUid)) return true;
  return false;
}

function isRelatedJob(job: OrthancJob, studyId: string, studyInstanceUid?: string): boolean {
  const content = job.Content ?? {};
  const parentResources = normalizeResourceRefs(content['ParentResources']);
  if (parentResources.some((r) => r.includes(studyId))) return true;

  const resources = normalizeResourceRefs(content['Resources']);
  if (resources.includes(studyId)) return true;

  const queries = Array.isArray(content['Query']) ? (content['Query'] as Record<string, string>[]) : [];
  if (queries.some((q) => q?.['0020,000d'] === studyInstanceUid)) return true;

  if (content['StudyInstanceUID'] === studyInstanceUid) return true;
  return false;
}

interface StudyActivityLogProps {
  studyId?: string;
  studyInstanceUid?: string;
}

export default function StudyActivityLog({ studyId, studyInstanceUid }: StudyActivityLogProps) {
  const { t } = useTranslation();
  const liveEvents = useAuditStore((s) => s.events);
  const { data: changesData, isLoading: changesLoading } = useChanges();
  const { data: orthancJobs = [], isLoading: jobsLoading } = useOrthancJobs();

  const events = useMemo(() => {
    if (!studyId) return [];

    const changeEvents = (changesData?.Changes ?? [])
      .filter((c) => isRelatedChange(c, studyId, studyInstanceUid))
      .map((c) => changeToActivity(c, t));

    const jobEvents = orthancJobs
      .filter((j) => isRelatedJob(j, studyId, studyInstanceUid))
      .map((j) => jobToActivity(j, t));

    const filteredLive = liveEvents.filter(
      (e) =>
        e.resource?.includes(studyId) ||
        e.metadata?.['Study ID'] === studyId ||
        e.description?.includes(studyId) ||
        (studyInstanceUid &&
          (e.resource?.includes(studyInstanceUid) || e.description?.includes(studyInstanceUid)))
    );

    const seen = new Set<string>();
    return [...filteredLive, ...jobEvents, ...changeEvents]
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [liveEvents, changesData, orthancJobs, studyId, studyInstanceUid, t]);

  if (!studyId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Info className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {t('studyDetail.noActivity', { defaultValue: 'No activity recorded' })}
        </p>
      </div>
    );
  }

  if (changesLoading || jobsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-8 w-8 text-muted-foreground/40 mb-3 animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">
          {t('studyDetail.loadingActivity', { defaultValue: 'Loading activity…' })}
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Info className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {t('studyDetail.noActivity', { defaultValue: 'No activity recorded' })}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {t('studyDetail.noActivityHint', {
            defaultValue: 'Past Orthanc changes and jobs for this study will appear here.',
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((entry, idx) => {
        const Icon = ACTION_ICONS[entry.action] ?? CheckCircle2;
        const isLast = idx === events.length - 1;
        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline gutter */}
            <div className="flex flex-col items-center pt-1">
              <div className={cn('rounded-full p-1.5 border bg-background', SEVERITY_STYLES[entry.severity])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-5', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{entry.title}</span>
                    {entry.severity === 'error' && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', SEVERITY_BADGE.error)}>
                        <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Error
                      </Badge>
                    )}
                    {entry.severity === 'warning' && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', SEVERITY_BADGE.warning)}>
                        <Clock className="h-2.5 w-2.5 mr-0.5" /> Warning
                      </Badge>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground">{formatRelative(entry.timestamp, t)}</span>
                  <div className="text-[10px] text-muted-foreground/60">
                    {format(new Date(entry.timestamp), 'HH:mm:ss')}
                  </div>
                </div>
              </div>

              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div className="mt-2 rounded-md border bg-muted/30 p-2 space-y-0.5">
                  {Object.entries(entry.metadata).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">{key}:</span>
                      <span className="font-mono text-[11px]">{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {entry.actor && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70">
                  {entry.actor}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
