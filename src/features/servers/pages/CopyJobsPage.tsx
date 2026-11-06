import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Copy, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { describeCopyJob, isMoveJob, type CopyJobView } from '@/features/servers/lib/copy-job';
import { usePersistedState } from '@/store/ui-state';
import { formatDicomDateTime } from '@/lib/dicom-date';

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
  const { data: jobs = [], isLoading, isError } = useOrthancJobs();
  const [filter, setFilter] = usePersistedState<JobFilter>('copyJobs.filter', 'all');

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
  const visible = filter === 'all' ? copies : copies.filter((job) => job.state === filter);

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
            <span className="text-muted-foreground">({entry.count})</span>
          </Button>
        ))}
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
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">{t('copyJobs.start', { defaultValue: 'Start' })}</TableHead>
                  <TableHead className="w-[150px]">{t('copyJobs.end', { defaultValue: 'End' })}</TableHead>
                  <TableHead className="w-[120px]">{t('copyJobs.source', { defaultValue: 'Source' })}</TableHead>
                  <TableHead className="w-[140px]">{t('copyJobs.target', { defaultValue: 'Target' })}</TableHead>
                  <TableHead>{t('copyJobs.study', { defaultValue: 'Study' })}</TableHead>
                  <TableHead className="w-[150px]">{t('copyJobs.state', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="w-[230px]">{t('copyJobs.dimse', { defaultValue: 'DIMSE' })}</TableHead>
                  <TableHead className="w-[90px]">{t('copyJobs.duration', { defaultValue: 'Duration' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((job) => (
                  <TableRow key={job.jobId}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDicomDateTime(job.creationTime, locale)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {job.state === 'running'
                        ? t('copyJobs.stillRunning', { defaultValue: 'running…' })
                        : formatDicomDateTime(job.completionTime, locale)}
                    </TableCell>
                    <TableCell className="text-sm">{job.sourceAet ?? '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{job.targetAet ?? '—'}</TableCell>
                    <TableCell className="text-sm font-mono">
                      <div>{job.patientId ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{job.studyInstanceUid ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusCell job={job} />
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
                ))}
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
