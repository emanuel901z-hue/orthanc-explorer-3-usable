import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Ban, CheckCircle2, Copy, Loader2, RotateCcw, Search, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHelp } from '@/shared/components/PageHelp';
import { useOrthancJobs } from '@/features/activity/hooks/useOrthancJobs';
import { jobsApi } from '@/api/jobs';
import { resolveTargetLabel } from '@/api/targets';
import { describeCopyJob, isMoveJob, type CopyJobView } from '@/features/servers/lib/copy-job';
import { usePersistedState, useRememberedState } from '@/store/ui-state';
import { formatDicomDateTime } from '@/lib/dicom-date';
import { toast } from 'sonner';

type JobFilter = 'all' | 'running' | 'failed' | 'warning' | 'success';

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`;
}

function StatusCell({ job }: { job: CopyJobView }) {
  const { t } = useTranslation();
  if (job.state === 'success') {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        {t('copyJobs.stateSuccess', { defaultValue: 'delivered cleanly' })}
      </Badge>
    );
  }
  if (job.state === 'warning') {
    return (
      <Badge variant="outline" className="gap-1 border-warning text-warning">
        <AlertTriangle className="h-3.5 w-3.5" />
        {t('copyJobs.stateWarning', { defaultValue: 'partly delivered' })}
      </Badge>
    );
  }
  if (job.state === 'failed') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3.5 w-3.5" />
        {t('copyJobs.stateFailed', { defaultValue: 'failed' })}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t('copyJobs.stateRunning', { defaultValue: 'running' })} {job.progress}%
    </Badge>
  );
}

export default function CopyJobsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: jobs = [], isLoading, isError, refetch } = useOrthancJobs();
  const [filter, setFilter] = usePersistedState<JobFilter>('copyJobs.filter', 'all');
  const [search, setSearch] = useRememberedState('copyJobs.search', '');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const copies = useMemo(
    () => jobs.filter(isMoveJob).map(describeCopyJob),
    [jobs],
  );
  const counts = useMemo(() => ({
    all: copies.length,
    running: copies.filter((job) => job.state === 'running').length,
    success: copies.filter((job) => job.state === 'success').length,
    failed: copies.filter((job) => job.state === 'failed').length,
    warning: copies.filter((job) => job.state === 'warning').length,
  }), [copies]);
  const visible = useMemo(() => {
    const byState = filter === 'all' ? copies : copies.filter((job) => job.state === filter);
    const term = search.trim().toLowerCase();
    if (!term) return byState;
    return byState.filter((job) => {
      const targetLabel = resolveTargetLabel(job.targetAet);
      return [
        job.patientId,
        job.patientName,
        job.studyInstanceUid,
        job.targetAet,
        targetLabel,
        job.sourceAet,
        job.dimseStatus,
        job.error,
      ].some((field) => field?.toLowerCase().includes(term));
    });
  }, [copies, filter, search]);

  const handleRetry = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await jobsApi.resubmit(jobId);
      await refetch?.();
      toast.success(t('copyJobs.retried', { defaultValue: 'Copy job restarted' }));
    } catch {
      toast.error(t('copyJobs.actionFailed', { defaultValue: 'Job action failed' }));
    } finally {
      setBusyJobId(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await jobsApi.cancel(jobId);
      await refetch?.();
      toast.success(t('copyJobs.canceled', { defaultValue: 'Copy job canceled' }));
    } catch {
      toast.error(t('copyJobs.actionFailed', { defaultValue: 'Job action failed' }));
    } finally {
      setBusyJobId(null);
    }
  };

  const filters: { id: JobFilter; label: string; count: number }[] = [
    { id: 'all', label: t('copyJobs.filterAll', { defaultValue: 'All' }), count: counts.all },
    { id: 'running', label: t('copyJobs.stateRunning', { defaultValue: 'running' }), count: counts.running },
    { id: 'failed', label: t('copyJobs.stateFailed', { defaultValue: 'failed' }), count: counts.failed },
    { id: 'warning', label: t('copyJobs.stateWarning', { defaultValue: 'partly delivered' }), count: counts.warning },
    { id: 'success', label: t('copyJobs.stateSuccess', { defaultValue: 'delivered' }), count: counts.success },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('copyJobs.title', { defaultValue: 'Copy jobs' })}</h1>
          <p className="text-sm text-muted-foreground">
            {t('copyJobs.subtitle', { defaultValue: 'C-MOVE orders this workstation sent to the archive' })}
          </p>
        </div>
        <PageHelp helpId="copyJobs" prefix="help" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((entry) => (
            <Button
              key={entry.id}
              variant={filter === entry.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
              <span className={filter === entry.id ? 'opacity-80' : 'text-muted-foreground'}>({entry.count})</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            data-shortcut="search"
            aria-label={t('copyJobs.searchPlaceholder', { defaultValue: 'Filter by patient ID, target or UID…' })}
            placeholder={t('copyJobs.searchPlaceholder', { defaultValue: 'Filter by patient ID, target or UID…' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('copyJobs.loading', { defaultValue: 'Loading jobs…' })}
          </CardContent>
        ) : isError ? (
          <CardContent className="py-12 text-center text-destructive">
            {t('copyJobs.loadFailed', { defaultValue: 'Jobs could not be loaded' })}
          </CardContent>
        ) : visible.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {copies.length === 0
              ? t('copyJobs.empty', { defaultValue: 'No copy orders yet. Remote Sources → “Copy to”.' })
              : t('copyJobs.emptyFiltered', { defaultValue: 'No jobs in this filter.' })}
          </CardContent>
        ) : (
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[125px]">{t('copyJobs.start', { defaultValue: 'Start' })}</TableHead>
                  <TableHead className="w-[125px]">{t('copyJobs.end', { defaultValue: 'End' })}</TableHead>
                  <TableHead className="w-[100px]">{t('copyJobs.source', { defaultValue: 'Source' })}</TableHead>
                  <TableHead className="w-[115px]">{t('copyJobs.target', { defaultValue: 'Target' })}</TableHead>
                  <TableHead>{t('copyJobs.study', { defaultValue: 'Study' })}</TableHead>
                  <TableHead className="w-[140px]">{t('copyJobs.state', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="w-[160px]">{t('copyJobs.dimse', { defaultValue: 'DIMSE' })}</TableHead>
                  <TableHead className="w-[75px]">{t('copyJobs.duration', { defaultValue: 'Duration' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((job) => {
                  const targetLabel = resolveTargetLabel(job.targetAet);
                  return (
                    <TableRow key={job.jobId}>
                      <TableCell className="text-sm whitespace-nowrap">{formatDicomDateTime(job.creationTime, locale)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {job.state === 'running'
                          ? t('copyJobs.stillRunning', { defaultValue: 'running…' })
                          : formatDicomDateTime(job.completionTime, locale)}
                      </TableCell>
                      <TableCell className="text-sm">{job.sourceAet ?? '—'}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {targetLabel && targetLabel !== job.targetAet && (
                          <div className="text-xs text-muted-foreground font-normal">{targetLabel}</div>
                        )}
                        <div>{job.targetAet ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm font-mono max-w-[220px]">
                        {job.patientName && <div className="font-sans text-xs font-medium truncate">{job.patientName}</div>}
                        <div className="truncate">{job.patientId ?? '—'}</div>
                        <div className="text-xs text-muted-foreground break-all">{job.studyInstanceUid ?? '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusCell job={job} />
                          {job.state === 'running' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              disabled={busyJobId === job.jobId}
                              aria-label={t('copyJobs.cancelJob', { defaultValue: 'Cancel job' })}
                              title={t('copyJobs.cancelJob', { defaultValue: 'Cancel job' })}
                              onClick={() => void handleCancel(job.jobId)}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(job.state === 'failed' || job.state === 'warning') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={busyJobId === job.jobId}
                              aria-label={t('copyJobs.retryJob', { defaultValue: 'Retry job' })}
                              title={t('copyJobs.retryJob', { defaultValue: 'Retry job' })}
                              onClick={() => void handleRetry(job.jobId)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {job.error && (
                            <span className="text-xs text-destructive" title={job.error}>
                              {job.error}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {/* Klartext zuerst — Hex-Codes kann im Alltag niemand lesen */}
                        <div>{t(`copyJobs.dimseMeaning.${job.dimseKey}`, { defaultValue: job.dimseStatus ?? '—' })}</div>
                        <div className="text-xs font-mono text-muted-foreground">{job.dimseStatus ?? ''}</div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDuration(job.durationSeconds)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        {t('copyJobs.dimseLegend', {
          defaultValue: 'DIMSE is the answer of the source archive: 0x0000 = all sub-operations delivered, 0xBxxx = some sub-operations failed, 0xAxxx = refused (e.g. unknown target), 0xCxxx = error, 0xFE00 = canceled.',
        })}
      </p>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Copy className="h-3.5 w-3.5" />
        {t('copyJobs.hint', {
          defaultValue: 'The list comes from the Orthanc job history — it is kept in memory and limited by "JobHistorySize".',
        })}
      </p>
    </div>
  );
}
