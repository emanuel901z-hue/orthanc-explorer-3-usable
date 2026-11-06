import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHelp } from '@/shared/components/PageHelp';
import { Globe, Radio, Search, Wifi, WifiOff, Download, Copy, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useModalities } from '@/features/settings/hooks/use-modalities';
import { useDicomWebServers } from '@/features/settings/hooks/use-dicom-web-servers';
import { modalitiesApi } from '@/api/modalities';
import { queryModalityAction } from '@/actions/queryModality';
import { retrieveModalityAction } from '@/actions/retrieveModality';
import { getConfig } from '@/config/runtime';
import { useOrthancJobs } from '@/features/activity/hooks/useOrthancJobs';
import { describeCopyJob } from '@/features/servers/lib/copy-job';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePersistedState, useRememberedState } from '@/store/ui-state';

interface RemoteStudy {
  queryId: string;
  answerIndex: number;
  patientName: string;
  patientId: string;
  studyDate: string;
  studyDescription: string;
  accessionNumber: string;
  modalities: string;
  studyInstanceUid: string;
  retrieving: boolean;
  retrieved: boolean;
  error: boolean;
  /** C-MOVE to a target archive — the study does not land in this Orthanc. */
  copying: boolean;
  /** Orthanc job the copy runs as; its state is the status shown in the row. */
  copyJobId?: string;
}

export default function RemoteSourcesPage() {
  const { t } = useTranslation();
  const { data: modalityNames = [] } = useModalities();
  const { data: dicomwebServers = [] } = useDicomWebServers();
  // Inline type intentionally widens the modality row with optional echo-status
  // fields — without them, the SelectItem status icon would always render the
  // "offline" variant even for reachable modalities. Defaults to undefined so
  // the UI falls back to WifiOff until an explicit C-ECHO updates the state.
  const modalities = modalityNames.map((name) => ({
    id: name,
    name,
    aet: name,
    host: '—',
    port: 0,
    lastEchoStatus: undefined as 'success' | 'failure' | undefined,
    lastEcho: undefined as Date | undefined,
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
  const [queryPatientName, setQueryPatientName] = useRememberedState('remoteSources.queryPatientName', '');
  const [queryPatientId, setQueryPatientId] = useRememberedState('remoteSources.queryPatientId', '');
  const [queryAccession, setQueryAccession] = useRememberedState('remoteSources.queryAccession', '');
  const [querying, setQuerying] = useState(false);
  const [remoteStudies, setRemoteStudies] = useState<RemoteStudy[]>([]);
  const [echoLoading, setEchoLoading] = useState(false);

  // C-FIND query against the selected modality
  const handleQuery = async () => {
    if (!selectedModality) {
      toast.error(t('remote.selectModalityFirst', { defaultValue: 'Please select a modality first' }));
      return;
    }
    setQuerying(true);
    setRemoteStudies([]);
    try {
      const query: Record<string, string> = {};
      if (queryPatientName) query['PatientName'] = `*${queryPatientName}*`;
      if (queryPatientId) query['PatientID'] = `*${queryPatientId}*`;
      if (queryAccession) query['AccessionNumber'] = `*${queryAccession}*`;
      query['StudyInstanceUID'] = '';

      const result = await queryModalityAction(selectedModality, {
        Level: 'Study',
        Query: query,
      });

      const studies: RemoteStudy[] = result.answers.map((ans) => {
        const tags = ans.tags;
        return {
          queryId: result.queryId,
          answerIndex: ans.index,
          patientName: tags['0010,0010'] || tags['PatientName'] || '—',
          patientId: tags['0010,0020'] || tags['PatientID'] || '—',
          studyDate: tags['0008,0020'] || tags['StudyDate'] || '—',
          studyDescription: tags['0008,1030'] || tags['StudyDescription'] || '—',
          accessionNumber: tags['0008,0050'] || tags['AccessionNumber'] || '—',
          modalities: tags['0008,0061'] || tags['ModalitiesInStudy'] || '—',
          studyInstanceUid: tags['0020,000d'] || tags['StudyInstanceUID'] || '',
          retrieving: false,
          retrieved: false,
          error: false,
          copying: false,
        };
      });

      setRemoteStudies(studies);
      toast.success(t('remote.querySuccess', { count: studies.length, defaultValue: `${studies.length} studies found` }));
    } catch {
      toast.error(t('remote.queryFailed', { defaultValue: 'C-FIND query failed' }));
    } finally {
      setQuerying(false);
    }
  };

  // C-MOVE retrieve for a specific query answer
  const handleRetrieve = async (study: RemoteStudy, index: number) => {
    setRemoteStudies((prev) => prev.map((s, i) => i === index ? { ...s, retrieving: true, error: false } : s));
    try {
      await retrieveModalityAction(selectedModality, study.queryId, study.answerIndex);
      setRemoteStudies((prev) => prev.map((s, i) => i === index ? { ...s, retrieving: false, retrieved: true } : s));
      toast.success(t('remote.retrieveStarted', { defaultValue: 'Retrieve started (C-MOVE)' }));
    } catch {
      setRemoteStudies((prev) => prev.map((s, i) => i === index ? { ...s, retrieving: false, error: true } : s));
      toast.error(t('remote.retrieveFailed', { defaultValue: 'Retrieve failed' }));
    }
  };

  const handleRetrieveAll = async () => {
    for (let i = 0; i < remoteStudies.length; i++) {
      const s = remoteStudies[i];
      if (!s.retrieved && !s.retrieving) {
        await handleRetrieve(s, i);
      }
    }
  };

  // Copy: C-MOVE through the queried archive to a target archive. The study
  // never passes through this Orthanc — the archive delivers it directly.
  // The order runs as an Orthanc job, so the row can show progress and the
  // DIMSE status the archive reported, and the job list keeps the history.
  const handleCopy = async (study: RemoteStudy, index: number) => {
    if (!selectedTarget) {
      toast.error(t('remote.copyNoTarget', { defaultValue: 'Choose a target first' }));
      return;
    }
    const mark = (patch: Partial<RemoteStudy>) =>
      setRemoteStudies((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

    mark({ copying: true, copyJobId: undefined });
    try {
      const result = await retrieveModalityAction(
        selectedModality,
        study.queryId,
        study.answerIndex,
        selectedTarget,
        { asynchronous: true },
      );
      const jobId = typeof result.ID === 'string' ? result.ID : undefined;
      mark({ copying: false, copyJobId: jobId });
      toast.success(t('remote.copyStarted', { target: selectedTarget, defaultValue: `C-MOVE to ${selectedTarget} sent` }));
    } catch {
      mark({ copying: false });
      toast.error(t('remote.copyFailedGeneric', { defaultValue: 'Copy failed' }));
    }
  };

  const handleCopyAll = async () => {
    if (!selectedTarget) {
      toast.error(t('remote.copyNoTarget', { defaultValue: 'Choose a target first' }));
      return;
    }
    for (let i = 0; i < remoteStudies.length; i++) {
      const s = remoteStudies[i];
      if (!s.copyJobId && !s.copying) {
        await handleCopy(s, i);
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
                            ) : (
                              <WifiOff className="h-3.5 w-3.5 text-destructive" />
                            )}
                            {m.name} ({m.aet})
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
                  onClick={async () => {
                    if (!selectedModality) return;
                    setEchoLoading(true);
                    try {
                      await modalitiesApi.echo(selectedModality);
                      toast.success(t('remote.echoSuccess', { defaultValue: 'C-ECHO successful' }));
                    } catch {
                      toast.error(t('remote.echoFailed', { defaultValue: 'C-ECHO failed' }));
                    } finally {
                      setEchoLoading(false);
                    }
                  }}
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
                    {m.lastEcho && <span>Last echo: {format(m.lastEcho, 'MMM dd, HH:mm')}</span>}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Search form */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input placeholder={t('remote.patientName')} value={queryPatientName} onChange={(e) => setQueryPatientName(e.target.value)} className="h-9" />
                <Input placeholder={t('remote.patientId')} value={queryPatientId} onChange={(e) => setQueryPatientId(e.target.value)} className="h-9" />
                <Input placeholder={t('remote.accessionNumber')} value={queryAccession} onChange={(e) => setQueryAccession(e.target.value)} className="h-9" />
                <Button className="gap-1.5" onClick={handleQuery} disabled={querying || !selectedModality}>
                  {querying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t('remote.query')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Query results */}
          {remoteStudies.length > 0 ? (
            <Card>
              <div className="flex items-center justify-between gap-3 p-3 border-b flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('remote.resultsCount', { count: remoteStudies.length, defaultValue: `${remoteStudies.length} studies found` })}
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
                    onClick={handleCopyAll}
                    disabled={!selectedTarget}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t('remote.copyAll', { defaultValue: 'Copy all' })}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleRetrieveAll}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('remote.retrieveAll', { defaultValue: 'Retrieve all' })}
                  </Button>
                </div>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('remote.patientName')}</TableHead>
                      <TableHead>{t('remote.patientId')}</TableHead>
                      <TableHead>{t('remote.studyDate')}</TableHead>
                      <TableHead>{t('remote.studyDescription')}</TableHead>
                      <TableHead>{t('remote.accessionNumber')}</TableHead>
                      <TableHead className="w-[190px]">{t('remote.actions', { defaultValue: 'Actions' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remoteStudies.map((study, i) => {
                      const copyJob = study.copyJobId ? copyJobs.get(study.copyJobId) : undefined;
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{study.patientName}</TableCell>
                          <TableCell className="text-sm font-mono">{study.patientId}</TableCell>
                          <TableCell className="text-sm">{study.studyDate}</TableCell>
                          <TableCell className="text-sm">{study.studyDescription}</TableCell>
                          <TableCell className="text-sm font-mono">{study.accessionNumber}</TableCell>
                          <TableCell>
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
                                  onClick={() => handleRetrieve(study, i)}
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
                                  onClick={() => handleCopy(study, i)}
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
    </div>
  );
}
