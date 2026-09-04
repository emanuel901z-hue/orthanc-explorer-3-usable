import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Radio, Search, Wifi, WifiOff, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RemoteStudy {
  queryId: string;
  answerId: string;
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
}

export default function RemoteSourcesPage() {
  const { t } = useTranslation();
  const { data: modalityNames = [] } = useModalities();
  const { data: dicomwebServers = [] } = useDicomWebServers();
  const modalities = modalityNames.map((name) => ({
    id: name,
    name,
    aet: name,
    host: '—',
    port: 0,
  }));
  const [selectedModality, setSelectedModality] = useState('');
  const [selectedServer, setSelectedServer] = useState('');
  const [queryPatientName, setQueryPatientName] = useState('');
  const [queryPatientId, setQueryPatientId] = useState('');
  const [queryAccession, setQueryAccession] = useState('');
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
      // Always request StudyInstanceUID
      query['StudyInstanceUID'] = '';

      const results = await modalitiesApi.query(selectedModality, {
        Level: 'Study',
        Query: query,
      });

      // Parse query answers — Orthanc returns array of answer objects
      const studies: RemoteStudy[] = [];
      if (Array.isArray(results)) {
        for (const answer of results) {
          const a = answer as Record<string, Record<string, string>>;
          const tags = a['0010,0010'] ? a : (a as any);
          studies.push({
            queryId: (answer as any).ID || '',
            answerId: (answer as any).ID || '',
            patientName: tags['0010,0010']?.Value || tags['PatientName'] || '—',
            patientId: tags['0010,0020']?.Value || tags['PatientID'] || '—',
            studyDate: tags['0008,0020']?.Value || tags['StudyDate'] || '—',
            studyDescription: tags['0008,1030']?.Value || tags['StudyDescription'] || '—',
            accessionNumber: tags['0008,0050']?.Value || tags['AccessionNumber'] || '—',
            modalities: tags['0008,0061']?.Value || tags['ModalitiesInStudy'] || '—',
            studyInstanceUid: tags['0020,000d']?.Value || tags['StudyInstanceUID'] || '',
            retrieving: false,
            retrieved: false,
            error: false,
          });
        }
      }
      setRemoteStudies(studies);
      toast.success(t('remote.querySuccess', { count: studies.length, defaultValue: `${studies.length} studies found` }));
    } catch (e) {
      toast.error(t('remote.queryFailed', { defaultValue: 'C-FIND query failed' }));
    } finally {
      setQuerying(false);
    }
  };

  // C-MOVE retrieve for a specific query answer
  const handleRetrieve = async (study: RemoteStudy, index: number) => {
    setRemoteStudies((prev) => prev.map((s, i) => i === index ? { ...s, retrieving: true } : s));
    try {
      await modalitiesApi.retrieve(selectedModality, study.queryId);
      setRemoteStudies((prev) => prev.map((s, i) => i === index ? { ...s, retrieving: false, retrieved: true } : s));
      toast.success(t('remote.retrieveStarted', { defaultValue: 'Retrieve started (C-MOVE)' }));
    } catch (e) {
      setRemoteStudies((prev) => prev.map((s, i) => i === index ? { ...s, retrieving: false, error: true } : s));
      toast.error(t('remote.retrieveFailed', { defaultValue: 'Retrieve failed' }));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('remote.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('remote.subtitle')}</p>
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
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('remote.patientName')}</TableHead>
                      <TableHead>{t('remote.patientId')}</TableHead>
                      <TableHead>{t('remote.studyDate')}</TableHead>
                      <TableHead>{t('remote.studyDescription')}</TableHead>
                      <TableHead>{t('remote.accessionNumber')}</TableHead>
                      <TableHead className="w-[100px]">{t('remote.retrieve', { defaultValue: 'Retrieve' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remoteStudies.map((study, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{study.patientName}</TableCell>
                        <TableCell className="text-sm font-mono">{study.patientId}</TableCell>
                        <TableCell className="text-sm">{study.studyDate}</TableCell>
                        <TableCell className="text-sm">{study.studyDescription}</TableCell>
                        <TableCell className="text-sm font-mono">{study.accessionNumber}</TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
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
