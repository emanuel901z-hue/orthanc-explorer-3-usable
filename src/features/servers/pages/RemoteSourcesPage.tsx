import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Radio, Search, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateDemoModalities, generateDemoDicomWebServers } from '@/shared/api/mock/demo-data-generator';
import { format } from 'date-fns';

const modalities = generateDemoModalities();
const dicomwebServers = generateDemoDicomWebServers();

export default function RemoteSourcesPage() {
  const { t } = useTranslation();
  const [selectedModality, setSelectedModality] = useState(modalities[0]?.id || '');
  const [selectedServer, setSelectedServer] = useState(dicomwebServers[0]?.id || '');

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('remote.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('remote.subtitle')}</p>
      </div>

      <Tabs defaultValue="dicom" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dicom" className="gap-1.5"><Radio className="h-3.5 w-3.5" /> {t('remote.dicomQR')}</TabsTrigger>
          <TabsTrigger value="dicomweb" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> DICOMweb</TabsTrigger>
        </TabsList>

        <TabsContent value="dicom" className="space-y-4">
          {/* Modality selector with status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('remote.remoteModality')}</label>
                  <Select value={selectedModality} onValueChange={setSelectedModality}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modalities.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            {m.lastEchoStatus === 'success'
                              ? <Wifi className="h-3.5 w-3.5 text-success" />
                              : <WifiOff className="h-3.5 w-3.5 text-destructive" />
                            }
                            {m.name} ({m.aet})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="mt-5">{t('remote.echo')}</Button>
              </div>

              {/* Connection info */}
              {(() => {
                const m = modalities.find((mod) => mod.id === selectedModality);
                if (!m) return null;
                return (
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>AET: <strong>{m.aet}</strong></span>
                    <span>Host: <strong>{m.host}:{m.port}</strong></span>
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
                <Input placeholder={t('remote.patientName')} className="h-9" />
                <Input placeholder={t('remote.patientId')} className="h-9" />
                <Input placeholder={t('remote.accessionNumber')} className="h-9" />
                <Button className="gap-1.5"><Search className="h-4 w-4" /> {t('remote.query')}</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('remote.queryHint')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dicomweb" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('remote.dicomwebServer')}</label>
                  <Select value={selectedServer} onValueChange={setSelectedServer}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dicomwebServers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="mt-5">{t('remote.testConnection')}</Button>
              </div>

              {(() => {
                const s = dicomwebServers.find((srv) => srv.id === selectedServer);
                if (!s) return null;
                return (
                  <div className="flex gap-3 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">{s.url}</span>
                    <div className="flex gap-1">
                      {s.hasQidoSupport && <Badge variant="outline" className="text-xs h-5">QIDO</Badge>}
                      {s.hasWadoSupport && <Badge variant="outline" className="text-xs h-5">WADO</Badge>}
                      {s.hasStowSupport && <Badge variant="outline" className="text-xs h-5">STOW</Badge>}
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
