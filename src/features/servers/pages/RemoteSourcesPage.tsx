import { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHelp } from '@/shared/components/PageHelp';
import {
  Globe,
  Radio,
  Search,
  Wifi,
  WifiOff,
  Download,
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useModalityDetails } from '@/features/settings/hooks/use-modality-details';
import { useDicomWebServers } from '@/features/settings/hooks/use-dicom-web-servers';
import { modalitiesApi } from '@/api/modalities';
import { queryModalityAction } from '@/actions/queryModality';
import { retrieveModalityAction } from '@/actions/retrieveModality';
import { getConfig } from '@/config/runtime';
import { useOrthancJobs } from '@/features/activity/hooks/useOrthancJobs';
import { describeCopyJob } from '@/features/servers/lib/copy-job';
import { buildRemoteQuery } from '@/features/servers/lib/remote-query';
import {
  mapRemoteAnswer,
  sortRemoteStudies,
  type RemoteSort,
  type RemoteSortKey,
  type RemoteStudy,
} from '@/features/servers/lib/remote-study';
import RemoteStudyDetailDialog from '@/features/servers/components/RemoteStudyDetailDialog';
import { formatDicomDate } from '@/lib/dicom-date';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePersistedState, useRememberedState } from '@/store/ui-state';

const DEFAULT_SORT: RemoteSort = { id: 'studyDate', desc: true };

/** Sortierbarer Spaltenkopf wie in der Studienliste. */
function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: RemoteSortKey;
  sort: RemoteSort;
  onSort: (column: RemoteSortKey) => void;
}) {
  const active = sort.id === column;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-1 h-8 px-0 font-semibold w-full min-w-0 justify-start whitespace-normal text-left"
      onClick={() => onSort(column)}
    >
      {/* umbrechen statt abschneiden — „Studienbeschreibung“ passt nicht in 120 px */}
      <span className="whitespace-normal leading-tight">{label}</span>
      {active && !sort.desc ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0" />
      ) : active && sort.desc ? (
        <ArrowDown className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      )}
    </Button>
  );
}

export default function RemoteSourcesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: modalityDetails = [] } = useModalityDetails();
  const { data: dicomwebServers = [] } = useDicomWebServers();
  // Echo result per modality. The icon shows what the last check said:
  // green = reachable, crossed out = failed, muted = not checked yet.
  const [echoStatus, setEchoStatus] = useState<Record<string, { ok: boolean; at: Date }>>({});
  const modalities = modalityDetails.map((modality) => ({
    ...modality,
    lastEchoStatus: echoStatus[modality.id] ? (echoStatus[modality.id].ok ? 'success' as const : 'failure' as const) : undefined,
    lastEcho: echoStatus[modality.id]?.at,
  }));
  // Target selection survives navigation; the query fields can contain PHI and
  // are therefore only kept in memory.
  const [selectedModality, setSelectedModality] = usePersistedState('remoteSources.modality', '');
  // Copy targets come from the deployment config (AET only — the archive that
  // holds the study knows the host). Persisted: the chosen archive is not PHI.
  const copyTargets = getConfig().cmoveTargets ?? [];
  const [selectedTarget, setSelectedTarget] = usePersistedState('remoteSources.copyTarget', '');
  // The copy runs as an Orthanc job; the job list (polled every 3 s) is where
  // progress and the DIMSE status of the destination come from.
  const { data: jobs = [] } = useOrthancJobs();
  const copyJobs = useMemo(
    () => new Map(jobs.map((job) => [job.ID, describeCopyJob(job)])),
    [jobs],
  );
  const [selectedServer, setSelectedServer] = usePersistedState('remoteSources.server', '');
  const [queryText, setQueryText] = useRememberedState('remoteSources.query', '');
  // Was die Suchzeile bedeutet — sichtbar als Chips, damit niemand raten muss,
  // warum ein Archiv nichts findet.
  const plan = useMemo(() => buildRemoteQuery(queryText), [queryText]);
  // Hinweis, wenn erst die zweite Deutung der Suche getroffen hat.
  const [searchNote, setSearchNote] = useState<string | undefined>(undefined);
  const [querying, setQuerying] = useState(false);
  const [remoteStudies, setRemoteStudies] = useState<RemoteStudy[]>([]);
  const [echoLoading, setEchoLoading] = useState(false);
  // Sortierung überlebt die Navigation; die Auswahl gilt für diesen Besuch.
  const [sort, setSort] = usePersistedState<RemoteSort>('remoteSources.sort', DEFAULT_SORT);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<RemoteStudy | null>(null);

  const sortedStudies = useMemo(() => sortRemoteStudies(remoteStudies, sort), [remoteStudies, sort]);
  const selectedStudies = useMemo(
    () => remoteStudies.filter((study) => selected.has(study.answerIndex)),
    [remoteStudies, selected],
  );

  const toggleSort = (column: RemoteSortKey) => {
    setSort((prev) => (prev.id === column ? { id: column, desc: !prev.desc } : { id: column, desc: false }));
  };

  const toggleSelected = (answerIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(answerIndex)) next.delete(answerIndex);
      else next.add(answerIndex);
      return next;
    });
  };

  /** Zustand einer Zeile ändern — über answerIndex, damit Sortieren nicht stört. */
  const patchStudy = useCallback((study: RemoteStudy, patch: Partial<RemoteStudy>) => {
    setRemoteStudies((prev) =>
      prev.map((entry) =>
        entry.queryId === study.queryId && entry.answerIndex === study.answerIndex
          ? { ...entry, ...patch }
          : entry,
      ),
    );
  }, []);

  const runEcho = useCallback(
    async (name: string, options: { silent?: boolean } = {}) => {
      if (!name) return;
      setEchoLoading(true);
      try {
        await modalitiesApi.echo(name);
        setEchoStatus((prev) => ({ ...prev, [name]: { ok: true, at: new Date() } }));
        if (!options.silent) {
          toast.success(t('remote.echoSuccess', { defaultValue: 'C-ECHO successful' }));
        }
      } catch {
        setEchoStatus((prev) => ({ ...prev, [name]: { ok: false, at: new Date() } }));
        if (!options.silent) {
          toast.error(t('remote.echoFailed', { defaultValue: 'C-ECHO failed' }));
        }
      } finally {
        setEchoLoading(false);
      }
    },
    [t],
  );

  // Wer eine Remote-Modalität auswählt, will wissen, ob sie antwortet — also
  // prüfen wir sie sofort (still, ohne Toast). Ein Fehlschlag wird nicht
  // automatisch wiederholt; dafür ist der Echo-Knopf da.
  useEffect(() => {
    if (selectedModality && !echoStatus[selectedModality]) {
      void runEcho(selectedModality, { silent: true });
    }
  }, [selectedModality, echoStatus, runEcho]);

  // C-FIND query against the selected modality
  const handleQuery = async () => {
    if (!selectedModality) {
      toast.error(t('remote.selectModalityFirst', { defaultValue: 'Please select a modality first' }));
      return;
    }
    if (plan.chips.length === 0) {
      toast.error(t('remote.searchEmpty', { defaultValue: 'Enter a name, patient ID, accession number or date' }));
      return;
    }
    setQuerying(true);
    setRemoteStudies([]);
    setSelected(new Set());
    setDetail(null);
    setSearchNote(undefined);
    try {
      let result = await queryModalityAction(selectedModality, {
        Level: 'Study',
        Query: plan.query,
      });

      // Nichts gefunden? Bei mehrdeutigen Teilen (ACC-1, E2E) die zweite
      // Deutung probieren — ein Archiv kann nur ein Attribut matchen.
      for (const alternative of plan.alternatives) {
        if (result.answers.length > 0) break;
        const retry = await queryModalityAction(selectedModality, {
          Level: 'Study',
          Query: alternative.query,
        });
        if (retry.answers.length > 0) {
          result = retry;
          const kind = t(`remote.searchKind.${alternative.chip.kind}`, { defaultValue: alternative.chip.kind });
          setSearchNote(t('remote.searchFoundAs', {
            kind,
            value: alternative.chip.value,
            defaultValue: `Found as ${kind}: ${alternative.chip.value}`,
          }));
        }
      }

      const studies = result.answers.map((ans) => mapRemoteAnswer(result.queryId, ans.index, ans.tags));
      setRemoteStudies(studies);
      toast.success(t('remote.querySuccess', { count: studies.length, defaultValue: `${studies.length} studies found` }));
    } catch {
      toast.error(t('remote.queryFailed', { defaultValue: 'C-FIND query failed' }));
    } finally {
      setQuerying(false);
    }
  };

  // C-MOVE retrieve for a specific query answer
  const handleRetrieve = async (study: RemoteStudy) => {
    patchStudy(study, { retrieving: true, error: false });
    try {
      await retrieveModalityAction(selectedModality, study.queryId, study.answerIndex);
      patchStudy(study, { retrieving: false, retrieved: true });
      toast.success(t('remote.retrieveStarted', { defaultValue: 'Retrieve started (C-MOVE)' }));
    } catch {
      patchStudy(study, { retrieving: false, error: true });
      toast.error(t('remote.retrieveFailed', { defaultValue: 'Retrieve failed' }));
    }
  };

  const handleRetrieveMany = async (studies: RemoteStudy[]) => {
    for (const study of studies) {
      if (!study.retrieved && !study.retrieving) {
        await handleRetrieve(study);
      }
    }
  };

  // Copy: C-MOVE through the queried archive to a target archive. The study
  // never passes through this Orthanc — the archive delivers it directly.
  // The order runs as an Orthanc job, so the row can show progress and the
  // DIMSE status the archive reported, and the job list keeps the history.
  const handleCopy = async (study: RemoteStudy) => {
    if (!selectedTarget) {
      toast.error(t('remote.copyNoTarget', { defaultValue: 'Choose a target first' }));
      return;
    }
    patchStudy(study, { copying: true, copyJobId: undefined });
    try {
      const result = await retrieveModalityAction(
        selectedModality,
        study.queryId,
        study.answerIndex,
        selectedTarget,
        { asynchronous: true },
      );
      const jobId = typeof result.ID === 'string' ? result.ID : undefined;
      patchStudy(study, { copying: false, copyJobId: jobId });
      toast.success(t('remote.copyStarted', { target: selectedTarget, defaultValue: `C-MOVE to ${selectedTarget} sent` }));
    } catch {
      patchStudy(study, { copying: false });
      toast.error(t('remote.copyFailedGeneric', { defaultValue: 'Copy failed' }));
    }
  };

  const handleCopyMany = async (studies: RemoteStudy[]) => {
    if (!selectedTarget) {
      toast.error(t('remote.copyNoTarget', { defaultValue: 'Choose a target first' }));
      return;
    }
    for (const study of studies) {
      if (!study.copyJobId && !study.copying) {
        await handleCopy(study);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('remote.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('remote.subtitle')}</p>
        </div>
        <PageHelp helpId="remoteSources" prefix="help" />
      </div>

      <Tabs defaultValue="dicom" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dicom" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" /> {t('remote.dicomQR')}
          </TabsTrigger>
          <TabsTrigger value="dicomweb" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> DICOMweb
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dicom" className="space-y-4">
          {/* Modality selector with status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('remote.remoteModality')}
                  </label>
                  <Select value={selectedModality} onValueChange={setSelectedModality}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modalities.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            {m.lastEchoStatus === 'success' ? (
                              <Wifi className="h-3.5 w-3.5 text-success" />
                            ) : m.lastEchoStatus === 'failure' ? (
                              <WifiOff className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {m.id} ({m.aet})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5 gap-1.5"
                  disabled={!selectedModality || echoLoading}
                  onClick={() => void runEcho(selectedModality)}
                >
                  {echoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  {t('remote.echo')}
                </Button>
              </div>

              {/* Connection info */}
              {(() => {
                const m = modalities.find((mod) => mod.id === selectedModality);
                if (!m) return null;
                return (
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>
                      AET: <strong>{m.aet}</strong>
                    </span>
                    <span>
                      Host:{' '}
                      <strong>
                        {m.host}:{m.port}
                      </strong>
                    </span>
                    {m.lastEcho && (
                      <span>
                        {t('remote.lastEcho', { defaultValue: 'Last echo' })}:{' '}
                        {format(m.lastEcho, 'MMM dd, HH:mm')}
                      </span>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Suchzeile: freier Text wird zur C-FIND-Abfrage */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-9 pl-9"
                    data-shortcut="search"
                    aria-label={t('remote.searchPlaceholder', { defaultValue: 'Search: name, patient ID, accession, date, modality' })}
                    placeholder={t('remote.searchPlaceholder', { defaultValue: 'Search: name, patient ID, accession, date, modality' })}
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleQuery();
                    }}
                  />
                </div>
                <Button className="gap-1.5 h-9" onClick={handleQuery} disabled={querying || !selectedModality}>
                  {querying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t('remote.query')}
                </Button>
              </div>

              {plan.chips.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-muted-foreground">{t('remote.searchParsed', { defaultValue: 'Sent as:' })}</span>
                  {plan.chips.map((chip) => (
                    <Badge key={`${chip.kind}-${chip.value}`} variant="secondary" className="font-normal">
                      {t(`remote.searchKind.${chip.kind}`, { defaultValue: chip.kind })}: <span className="font-mono ml-1">{chip.value}</span>
                    </Badge>
                  ))}
                </div>
              )}

              {plan.ignored.length > 0 && (
                <p className="text-xs text-destructive">
                  {t('remote.searchIgnored', {
                    value: plan.ignored.join(', '),
                    defaultValue: 'Not used: {{value}} — a date needs a year.',
                  })}
                </p>
              )}

              {searchNote && (
                <p className="text-xs text-muted-foreground">{searchNote}</p>
              )}

              <p className="text-xs text-muted-foreground">{t('remote.searchHint', {
                defaultValue: 'Comma separates entries (Muster,Erika,030626), a space separates parts of one entry.',
              })}</p>
            </CardContent>
          </Card>

          {/* Query results */}
          {remoteStudies.length > 0 ? (
            <Card>
              <div className="flex items-center justify-between gap-3 p-3 border-b flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('remote.resultsCount', { count: remoteStudies.length, defaultValue: `${remoteStudies.length} studies found` })}
                  {selected.size > 0 && ` · ${t('remote.selectedCount', { count: selected.size, defaultValue: `${selected.size} selected` })}`}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <label htmlFor="copy-target" className="text-xs text-muted-foreground">
                    {t('remote.copyTarget', { defaultValue: 'Copy to' })}
                  </label>
                  <select
                    id="copy-target"
                    aria-label={t('remote.copyTarget', { defaultValue: 'Copy to' })}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                  >
                    <option value="">
                      {copyTargets.length === 0
                        ? t('remote.copyTargetsEmpty', { defaultValue: 'No targets configured' })
                        : t('remote.copyTargetNone', { defaultValue: '— target —' })}
                    </option>
                    {copyTargets.map((target) => (
                      <option key={target.aet} value={target.aet}>
                        {target.label ? `${target.label} (${target.aet})` : target.aet}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void handleCopyMany(selectedStudies.length > 0 ? selectedStudies : remoteStudies)}
                    disabled={!selectedTarget}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {selectedStudies.length > 0
                      ? t('remote.copySelected', { count: selectedStudies.length, defaultValue: `Copy (${selectedStudies.length})` })
                      : t('remote.copyAll', { defaultValue: 'Copy all' })}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void handleRetrieveMany(selectedStudies.length > 0 ? selectedStudies : remoteStudies)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {selectedStudies.length > 0
                      ? t('remote.retrieveSelected', { count: selectedStudies.length, defaultValue: `Retrieve (${selectedStudies.length})` })
                      : t('remote.retrieveAll', { defaultValue: 'Retrieve all' })}
                  </Button>
                </div>
              </div>
              <CardContent className="p-0 overflow-x-auto">
                {/* sieben Spalten: auf schmalen Fenstern lieber scrollen als
                    die Köpfe abschneiden */}
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[36px]">
                        <Checkbox
                          checked={selected.size > 0 && selected.size === remoteStudies.length}
                          onCheckedChange={(value) => {
                            setSelected(value ? new Set(remoteStudies.map((study) => study.answerIndex)) : new Set());
                          }}
                          aria-label={t('remote.selectAll', { defaultValue: 'Select all' })}
                        />
                      </TableHead>
                      <TableHead>
                        <SortHeader label={t('remote.patientName')} column="patientName" sort={sort} onSort={toggleSort} />
                      </TableHead>
                      <TableHead>
                        <SortHeader label={t('remote.patientId')} column="patientId" sort={sort} onSort={toggleSort} />
                      </TableHead>
                      <TableHead>
                        <SortHeader label={t('remote.studyDate')} column="studyDate" sort={sort} onSort={toggleSort} />
                      </TableHead>
                      <TableHead>
                        <SortHeader label={t('remote.studyDescription')} column="studyDescription" sort={sort} onSort={toggleSort} />
                      </TableHead>
                      <TableHead>
                        <SortHeader label={t('remote.accessionNumber')} column="accessionNumber" sort={sort} onSort={toggleSort} />
                      </TableHead>
                      <TableHead className="w-[90px]">
                        <SortHeader
                          label={t('remote.searchKind.modality', { defaultValue: 'Modality' })}
                          column="modalities"
                          sort={sort}
                          onSort={toggleSort}
                        />
                      </TableHead>
                      <TableHead className="w-[190px]">{t('remote.actions', { defaultValue: 'Actions' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStudies.map((study) => {
                      const copyJob = study.copyJobId ? copyJobs.get(study.copyJobId) : undefined;
                      return (
                        <TableRow
                          key={study.answerIndex}
                          className="cursor-pointer"
                          onClick={() => setDetail(study)}
                          data-testid="remote-study-row"
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(study.answerIndex)}
                              onCheckedChange={() => toggleSelected(study.answerIndex)}
                              aria-label={t('remote.selectRow', { defaultValue: 'Select study' })}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{study.patientName}</div>
                            {study.birthDate && (
                              <div className="text-xs text-muted-foreground">{formatDicomDate(study.birthDate, locale)}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-mono">{study.patientId}</TableCell>
                          <TableCell className="text-sm">{formatDicomDate(study.studyDate, locale)}</TableCell>
                          <TableCell className="text-sm">{study.studyDescription}</TableCell>
                          <TableCell className="text-sm font-mono">{study.accessionNumber}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline" className="font-mono text-xs">{study.modalities}</Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              {study.retrieved ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : study.error ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 h-7"
                                  disabled={study.retrieving}
                                  onClick={() => void handleRetrieve(study)}
                                >
                                  {study.retrieving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                  {t('remote.retrieve', { defaultValue: 'Retrieve' })}
                                </Button>
                              )}
                              {study.copying ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {t('remote.copySending', { defaultValue: 'sending' })}
                                </span>
                              ) : copyJob?.state === 'success' ? (
                                <span className="flex items-center gap-1 text-xs text-success">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {copyJob.dimseStatus}
                                </span>
                              ) : copyJob?.state === 'warning' ? (
                                <span className="flex items-center gap-1 text-xs text-warning" title={copyJob.error}>
                                  <AlertTriangle className="h-4 w-4" />
                                  {copyJob.dimseStatus}
                                </span>
                              ) : copyJob?.state === 'failed' ? (
                                <span className="flex items-center gap-1 text-xs text-destructive" title={copyJob.error}>
                                  <XCircle className="h-4 w-4" />
                                  {copyJob.dimseStatus ?? t('remote.copyFailedGeneric', { defaultValue: 'Copy failed' })}
                                </span>
                              ) : copyJob ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {copyJob.progress}%
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 h-7"
                                  disabled={!selectedTarget}
                                  title={selectedTarget ? undefined : t('remote.copyNoTarget', { defaultValue: 'Choose a target first' })}
                                  onClick={() => void handleCopy(study)}
                                >
                                  <Copy className="h-3 w-3" />
                                  {t('remote.copy', { defaultValue: 'Copy' })}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {querying ? t('remote.querying', { defaultValue: 'Querying...' }) : t('remote.queryHint')}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dicomweb" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('remote.dicomwebServer')}
                  </label>
                  <Select value={selectedServer} onValueChange={setSelectedServer}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dicomwebServers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="mt-5">
                  {t('remote.testConnection')}
                </Button>
              </div>

              {(() => {
                const s = dicomwebServers.find((srv) => srv.id === selectedServer);
                if (!s) return null;
                return (
                  <div className="flex gap-3 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">{s.url}</span>
                    <div className="flex gap-1">
                      {s.hasQidoSupport && (
                        <Badge variant="outline" className="text-xs h-5">
                          QIDO
                        </Badge>
                      )}
                      {s.hasWadoSupport && (
                        <Badge variant="outline" className="text-xs h-5">
                          WADO
                        </Badge>
                      )}
                      {s.hasStowSupport && (
                        <Badge variant="outline" className="text-xs h-5">
                          STOW
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('remote.dicomwebHint')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RemoteStudyDetailDialog
        study={detail}
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        locale={locale}
        targetAet={selectedTarget}
        onRetrieve={(study) => {
          void handleRetrieve(study);
        }}
        onCopy={(study) => {
          void handleCopy(study);
        }}
      />
    </div>
  );
}
