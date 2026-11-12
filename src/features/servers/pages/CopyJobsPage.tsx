import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { copyJournalApi } from '@/api/copy-journal';
import { hiddenJobsApi } from '@/api/hidden-jobs';
import { deleteJobAction } from '@/actions/deleteJob';
import { hideCopyJobsAction, showCopyJobsAction } from '@/actions/hideCopyJobs';
import { applyCopyNote, describeCopyJob, isMoveJob, type CopyJobView } from '@/features/servers/lib/copy-job';
import { usePersistedState, useRememberedState } from '@/store/ui-state';
import { formatDicomDate, formatDicomDateTime } from '@/lib/dicom-date';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading, isError, refetch } = useOrthancJobs();
  // Der Orthanc-Job trägt nur die Haupt-Tags — Name und Geburtsdatum kommen
  // aus dem Kopier-Journal, das die Kopier-Seite beim Auftrag mitschreibt.
  const { data: journal = [] } = useQuery({
    queryKey: ['copy-journal'],
    queryFn: () => copyJournalApi.list(),
    staleTime: 30_000,
  });
  // Ausgeblendete Aufträge liegen serverseitig — dieselbe Liste für alle.
  const { data: hiddenIds = [] } = useQuery({
    queryKey: ['copy-jobs-hidden'],
    queryFn: () => hiddenJobsApi.list(),
    staleTime: 30_000,
  });
  const [filter, setFilter] = usePersistedState<JobFilter>('copyJobs.filter', 'all');
  const [search, setSearch] = useRememberedState('copyJobs.search', '');
  const [showHidden, setShowHidden] = usePersistedState('copyJobs.showHidden', false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const notes = useMemo(
    () => new Map(journal.map((entry) => [entry.jobId, entry])),
    [journal],
  );
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const copies = useMemo(
    () => jobs.filter(isMoveJob).map(describeCopyJob).map((job) => applyCopyNote(job, notes.get(job.jobId))),
    [jobs, notes],
  );
  /** Was die Liste zeigt: ohne ausgeblendete Aufträge, außer man will sie sehen. */
  const base = useMemo(
    () => (showHidden ? copies : copies.filter((job) => !hidden.has(job.jobId))),
    [copies, hidden, showHidden],
  );
  const counts = useMemo(() => ({
    all: base.length,
    running: base.filter((job) => job.state === 'running').length,
    success: base.filter((job) => job.state === 'success').length,
    failed: base.filter((job) => job.state === 'failed').length,
    warning: base.filter((job) => job.state === 'warning').length,
  }), [base]);
  const visible = useMemo(() => {
    const byState = filter === 'all' ? base : base.filter((job) => job.state === filter);
    const term = search.trim().toLowerCase();
    if (!term) return byState;
    return byState.filter((job) => {
      const targetLabel = resolveTargetLabel(job.targetAet);
      return [
        job.patientId,
        job.patientName,
        // Geburtsdatum roh und in der Schreibweise der Oberfläche
        job.birthDate,
        job.birthDate ? formatDicomDate(job.birthDate, locale) : undefined,
        job.studyDescription,
        job.accessionNumber,
        job.studyInstanceUid,
        job.targetAet,
        targetLabel,
        job.sourceAet,
        // Start/Ende ebenfalls — so lässt sich „alles von einem Tag“ filtern
        job.creationTime,
        job.creationTime ? formatDicomDateTime(job.creationTime, locale) : undefined,
        job.completionTime,
        job.completionTime ? formatDicomDateTime(job.completionTime, locale) : undefined,
        job.dimseStatus,
        job.error,
      ].some((field) => field?.toLowerCase().includes(term));
    });
  }, [base, filter, search, locale]);

  // Eine Auswahl gehört zu dem, was gerade sichtbar ist — beim Umschalten von
  // Filter, Suche oder Ausblenden fängt sie neu an.
  useEffect(() => {
    setSelected(new Set());
  }, [filter, search, showHidden]);

  const selectedJobs = useMemo(
    () => visible.filter((job) => selected.has(job.jobId)),
    [visible, selected],
  );
  // Orthanc löscht nur abgeschlossene Jobs — laufende muss man erst abbrechen.
  const deletable = useMemo(
    () => selectedJobs.filter((job) => job.state !== 'running'),
    [selectedJobs],
  );
  const allVisibleSelected = visible.length > 0 && selectedJobs.length === visible.length;

  const toggleJob = (jobId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleRetry = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      const result = await jobsApi.resubmit(jobId);
      // Ein erneuter Auftrag ist ein neuer Job — die Mitschrift zieht mit,
      // sonst stünde die Studie danach wieder ohne Namen da.
      const newJobId = typeof result.ID === 'string' ? result.ID : undefined;
      const note = notes.get(jobId);
      if (newJobId && note) {
        void copyJournalApi
          .record({ ...note, jobId: newJobId, recordedAt: new Date().toISOString() })
          .then(() => queryClient.invalidateQueries({ queryKey: ['copy-journal'] }))
          .catch(() => { });
      }
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

  /** Ausblenden: nur die Liste lässt den Auftrag weg, Orthanc behält ihn. */
  const handleHide = async () => {
    if (selectedJobs.length === 0) return;
    setBulkBusy(true);
    try {
      await hideCopyJobsAction(selectedJobs.map((job) => job.jobId));
      await queryClient.invalidateQueries({ queryKey: ['copy-jobs-hidden'] });
      setSelected(new Set());
      toast.success(t('copyJobs.hidden', {
        count: selectedJobs.length,
        defaultValue: `Hidden: ${selectedJobs.length}`,
      }));
    } catch {
      toast.error(t('copyJobs.actionFailed', { defaultValue: 'Job action failed' }));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleShow = async () => {
    if (selectedJobs.length === 0) return;
    setBulkBusy(true);
    try {
      await showCopyJobsAction(selectedJobs.map((job) => job.jobId));
      await queryClient.invalidateQueries({ queryKey: ['copy-jobs-hidden'] });
      setSelected(new Set());
      toast.success(t('copyJobs.shown', {
        count: selectedJobs.length,
        defaultValue: `Shown again: ${selectedJobs.length}`,
      }));
    } catch {
      toast.error(t('copyJobs.actionFailed', { defaultValue: 'Job action failed' }));
    } finally {
      setBulkBusy(false);
    }
  };

  /** Löschen: Auftrag und Mitschrift verschwinden endgültig. */
  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    if (deletable.length === 0) return;
    setBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const job of deletable) {
      try {
        await deleteJobAction(job.jobId);
        done += 1;
        void copyJournalApi.remove(job.jobId).catch(() => { });
      } catch {
        failed += 1;
      }
    }
    // Ausblend-Einträge gelöschter Aufträge sind sinnlos geworden
    if (done > 0) void hiddenJobsApi.show(deletable.map((job) => job.jobId)).catch(() => { });
    await refetch?.();
    await queryClient.invalidateQueries({ queryKey: ['copy-journal'] });
    await queryClient.invalidateQueries({ queryKey: ['copy-jobs-hidden'] });
    setSelected(new Set());
    setBulkBusy(false);
    if (failed > 0) {
      toast.error(t('copyJobs.deletedPartial', {
        done,
        failed,
        defaultValue: `Deleted: ${done}, failed: ${failed}`,
      }));
    } else {
      toast.success(t('copyJobs.deleted', { count: done, defaultValue: `Deleted: ${done}` }));
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
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              data-shortcut="search"
              aria-label={t('copyJobs.searchPlaceholder', { defaultValue: 'Filter by name, birth date, patient ID, target or UID…' })}
              placeholder={t('copyJobs.searchPlaceholder', { defaultValue: 'Filter by name, birth date, patient ID, target or UID…' })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showHidden ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            aria-pressed={showHidden}
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showHidden
              ? t('copyJobs.hideHidden', { defaultValue: 'Hide hidden' })
              : t('copyJobs.showHidden', { count: hiddenIds.length, defaultValue: `Show hidden (${hiddenIds.length})` })}
          </Button>
        </div>
      </div>

      {selectedJobs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium">
            {t('copyJobs.selectionCount', { count: selectedJobs.length, defaultValue: `${selectedJobs.length} selected` })}
          </span>
          {showHidden ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={bulkBusy}
              onClick={() => void handleShow()}
            >
              <Eye className="h-3.5 w-3.5" />
              {t('copyJobs.showSelected', { count: selectedJobs.length, defaultValue: `Show (${selectedJobs.length})` })}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={bulkBusy}
              onClick={() => void handleHide()}
            >
              <EyeOff className="h-3.5 w-3.5" />
              {t('copyJobs.hideSelected', { count: selectedJobs.length, defaultValue: `Hide (${selectedJobs.length})` })}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs text-destructive"
            disabled={bulkBusy || deletable.length === 0}
            title={deletable.length === 0
              ? t('copyJobs.runningNotDeletable', { defaultValue: 'Running jobs must be canceled first' })
              : undefined}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('copyJobs.deleteSelected', { count: deletable.length, defaultValue: `Delete (${deletable.length})` })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ms-auto"
            onClick={() => setSelected(new Set())}
          >
            {t('copyJobs.clearSelection', { defaultValue: 'Clear selection' })}
          </Button>
        </div>
      )}

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
              : base.length === 0
                ? t('copyJobs.emptyHidden', { defaultValue: 'All copy jobs are hidden. Use “Show hidden”.' })
                : t('copyJobs.emptyFiltered', { defaultValue: 'No jobs in this filter.' })}
          </CardContent>
        ) : (
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32px] px-2">
                    <Checkbox
                      checked={allVisibleSelected ? true : selectedJobs.length > 0 ? 'indeterminate' : false}
                      onCheckedChange={(value) => {
                        setSelected(value ? new Set(visible.map((job) => job.jobId)) : new Set());
                      }}
                      aria-label={t('copyJobs.selectAllVisible', { defaultValue: 'Select all visible' })}
                    />
                  </TableHead>
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
                  const isHidden = hidden.has(job.jobId);
                  return (
                    <TableRow key={job.jobId} className={isHidden ? 'opacity-60' : undefined}>
                      <TableCell className="px-2">
                        <Checkbox
                          checked={selected.has(job.jobId)}
                          onCheckedChange={() => toggleJob(job.jobId)}
                          aria-label={t('copyJobs.selectRow', { defaultValue: 'Select copy job' })}
                        />
                      </TableCell>
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
                      <TableCell className="text-sm font-mono max-w-[240px]">
                        <div className="font-sans text-xs font-medium truncate">{job.patientName ?? '—'}</div>
                        <div className="truncate">
                          {job.patientId ?? '—'}
                          {job.birthDate ? ` · ${formatDicomDate(job.birthDate, locale)}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">{job.studyInstanceUid ?? '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusCell job={job} />
                          {isHidden && (
                            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                              <EyeOff className="h-3 w-3" />
                              {t('copyJobs.hiddenBadge', { defaultValue: 'hidden' })}
                            </Badge>
                          )}
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

      <p className="text-xs text-muted-foreground">
        {t('copyJobs.hideHint', {
          defaultValue: 'Hiding only affects this list — the job stays in Orthanc as evidence. Deleting removes it from the job history for good.',
        })}
      </p>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Copy className="h-3.5 w-3.5" />
        {t('copyJobs.hint', {
          defaultValue: 'The list comes from the Orthanc job history — it is persisted in the database (SaveJobs) and limited by "JobsHistorySize".',
        })}
      </p>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('copyJobs.deleteTitle', { defaultValue: 'Delete copy jobs?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('copyJobs.deleteBody', {
                count: deletable.length,
                defaultValue: `The selected copy jobs (${deletable.length}) will be removed from the Orthanc job history. This cannot be undone — the DIMSE result goes with them.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              {t('common.delete', { defaultValue: 'Delete' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
