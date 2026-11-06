import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Copy, Loader2, XCircle } from 'lucide-react';
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

type JobFilter = 'all' | 'running' | 'failed' | 'success';

function formatTime(value?: string): string {
  // Orthanc liefert "20261106T114657.029587"
  if (!value || value.length < 15) return '—';
  const [, date = '', time = ''] = /^(\d{8})T(\d{6})/.exec(value) ?? [];
  if (!date || !time) return value;
  return `${date.slice(6, 8)}.${date.slice(4, 6)}.${date.slice(0, 4)} ${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

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
        {t('copyJobs.stateSuccess', { defaultValue: 'delivered' })}
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
  const { t } = useTranslation();
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
  }), [copies]);
  const visible = filter === 'all' ? copies : copies.filter((job) => job.state === filter);

  const filters: { id: JobFilter; label: string; count: number }[] = [
    { id: 'all', label: t('copyJobs.filterAll', { defaultValue: 'All' }), count: counts.all },
    { id: 'running', label: t('copyJobs.stateRunning', { defaultValue: 'running' }), count: counts.running },
    { id: 'failed', label: t('copyJobs.stateFailed', { defaultValue: 'failed' }), count: counts.failed },
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
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('copyJobs.when', { defaultValue: 'Time' })}</TableHead>
                  <TableHead>{t('copyJobs.source', { defaultValue: 'Source' })}</TableHead>
                  <TableHead>{t('copyJobs.target', { defaultValue: 'Target' })}</TableHead>
                  <TableHead>{t('copyJobs.study', { defaultValue: 'Study' })}</TableHead>
                  <TableHead>{t('copyJobs.state', { defaultValue: 'Status' })}</TableHead>
                  <TableHead>{t('copyJobs.dimse', { defaultValue: 'DIMSE' })}</TableHead>
                  <TableHead>{t('copyJobs.duration', { defaultValue: 'Duration' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((job) => (
                  <TableRow key={job.jobId}>
                    <TableCell className="text-sm whitespace-nowrap">{formatTime(job.creationTime)}</TableCell>
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
                    <TableCell className="text-sm font-mono">{job.dimseStatus ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDuration(job.durationSeconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Copy className="h-3.5 w-3.5" />
        {t('copyJobs.hint', {
          defaultValue: 'The list comes from the Orthanc job history — it is kept in memory and limited by "JobHistorySize".',
        })}
      </p>
    </div>
  );
}
