/**
 * TlsCard — DICOM TLS and the certificate handling around it.
 *
 * Written for the operator who has to administer the broker without being a PKI
 * specialist: the card answers three questions in plain words —
 * *is it switched on?*, *are my certificates usable (and how long do they
 * live?)* and *does the other side accept me?* The last one is a real handshake
 * with an optional C-ECHO, so a modality can be switched over with confidence.
 *
 * Everything is off by default: a LAN/VPN installation keeps working unchanged.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { brokerApi, type BrokerSetting, type TlsTestResult } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { errorMessage, useBrokerSettingWrites } from '../hooks/use-broker-writes';
import { useSettingDraft } from '../hooks/use-setting-draft';
import { useTlsWrites } from '../hooks/use-broker-tls';

const INBOUND_KEYS = [
  'tls_inbound_enabled', 'tls_inbound_port', 'tls_inbound_cert_file',
  'tls_inbound_key_file', 'tls_inbound_ca_file', 'tls_inbound_client_auth',
];
const OUTBOUND_KEYS = [
  'tls_outbound_verify', 'tls_outbound_ca_file',
  'tls_outbound_client_cert_file', 'tls_outbound_client_key_file',
];
const MANAGED_KEYS = ['tls_dir'];

export function TlsCard({ settings }: { settings: BrokerSetting[] }) {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const { setValue } = useBrokerSettingWrites();
  const { generate, test } = useTlsWrites();

  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  // a local draft per field: the value is committed when the field is left
  const draft = useSettingDraft(byKey, (key, next) => setValue.mutate({ key, value: next }));
  const value = draft.value;
  const source = (key: string) => byKey.get(key)?.source ?? 'env';
  const isOn = (key: string) => ['true', '1', 'yes', 'on'].includes(value(key).toLowerCase());

  const [showGenerate, setShowGenerate] = useState(false);
  const [cn, setCn] = useState('mwl-broker.hospital.local');
  const [days, setDays] = useState('3650');
  const [san, setSan] = useState('');
  const [isCa, setIsCa] = useState(false);
  const [generated, setGenerated] = useState<{ certificate_pem: string; certificate_path: string } | null>(null);

  const [testHost, setTestHost] = useState('');
  const [testPort, setTestPort] = useState('2762');
  const [testEcho, setTestEcho] = useState('');
  const [testResult, setTestResult] = useState<TlsTestResult | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['broker', 'tls'],
    queryFn: brokerApi.tls.overview,
    enabled: configured,
    refetchInterval: 60000,
  });
  const overview = overviewQuery.data;

  const settingRow = (key: string, labelKey: string, type = 'text') => (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label htmlFor={key}>{t(labelKey)}</Label>
        <Badge variant={source(key) === 'db' ? 'secondary' : 'outline'} className="text-xs">
          {source(key) === 'db' ? t('broker.settingOverridden') : t('broker.settingFromEnv')}
        </Badge>
      </div>
      <Input
        id={key}
        type={type}
        className="font-mono text-xs"
        value={value(key)}
        onChange={(event) => setValue.mutate({ key, value: event.target.value })}
      />
    </div>
  );

  const certificateBadge = (role: string) => {
    const entry = overview?.entries?.[role] as
      { ok?: boolean; days_left?: number | null; expired?: boolean; expiring_soon?: boolean;
        error?: string; mode?: string; world_readable?: boolean } | undefined;
    if (!entry?.ok) {
      return <Badge variant="outline" className="text-xs">{t('broker.tlsNotConfigured')}</Badge>;
    }
    // a private key has no expiry date — show its permissions instead
    if (role.endsWith('_key')) {
      return entry.world_readable ? (
        <Badge variant="destructive" className="text-xs">
          {t('broker.tlsKeyWorldReadable', { mode: entry.mode })}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs">
          {t('broker.tlsKeyMode', { mode: entry.mode })}
        </Badge>
      );
    }
    if (entry.expired) {
      return <Badge variant="destructive" className="text-xs">{t('broker.tlsExpired')}</Badge>;
    }
    if (entry.expiring_soon) {
      return (
        <Badge variant="secondary" className="text-xs">
          {t('broker.tlsExpiresIn', { days: entry.days_left })}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {t('broker.tlsValidDays', { days: entry.days_left })}
      </Badge>
    );
  };

  return (
    <Card data-testid="tls-card">
      <CardContent className="p-3 sm:p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t('broker.tlsTitle')}</span>
          {overview?.inbound_enabled ? (
            <Badge variant="secondary" className="text-xs">
              {t('broker.tlsListenerOn', { port: overview.inbound_port })}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t('broker.tlsListenerOff')}</Badge>
          )}
          <span className="text-xs text-muted-foreground">{t('broker.tlsHint')}</span>
        </div>

        {/* inbound */}
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="tls-inbound">{t('broker.tlsInbound')}</Label>
              <p className="text-xs text-muted-foreground">{t('broker.tlsInboundHint')}</p>
            </div>
            <Switch
              id="tls-inbound"
              checked={isOn('tls_inbound_enabled')}
              onCheckedChange={(checked) =>
                setValue.mutate({ key: 'tls_inbound_enabled', value: checked ? 'true' : 'false' })}
            />
          </div>
          {isOn('tls_inbound_enabled') && (
            <div className="grid gap-3 sm:grid-cols-2">
              {settingRow('tls_inbound_port', 'broker.setting_tls_inbound_port', 'number')}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tls_inbound_client_auth">
                    {t('broker.setting_tls_inbound_client_auth')}
                  </Label>
                </div>
                <Select
                  value={value('tls_inbound_client_auth') || 'none'}
                  onValueChange={(next) =>
                    setValue.mutate({ key: 'tls_inbound_client_auth', value: next })}
                >
                  <SelectTrigger id="tls_inbound_client_auth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('broker.tlsClientAuthNone')}</SelectItem>
                    <SelectItem value="optional">{t('broker.tlsClientAuthOptional')}</SelectItem>
                    <SelectItem value="required">{t('broker.tlsClientAuthRequired')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('broker.tlsClientAuthHint')}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tls_inbound_cert_file">
                    {t('broker.setting_tls_inbound_cert_file')}
                  </Label>
                  {certificateBadge('inbound_cert')}
                </div>
                <Input
                  id="tls_inbound_cert_file"
                  className="font-mono text-xs"
                  value={value('tls_inbound_cert_file')}
                  onChange={(event) =>
                    setValue.mutate({ key: 'tls_inbound_cert_file', value: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tls_inbound_key_file">
                    {t('broker.setting_tls_inbound_key_file')}
                  </Label>
                  {certificateBadge('inbound_key')}
                </div>
                <Input
                  id="tls_inbound_key_file"
                  className="font-mono text-xs"
                  value={value('tls_inbound_key_file')}
                  onChange={(event) =>
                    setValue.mutate({ key: 'tls_inbound_key_file', value: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tls_inbound_ca_file">
                    {t('broker.setting_tls_inbound_ca_file')}
                  </Label>
                  {certificateBadge('inbound_ca')}
                </div>
                <Input
                  id="tls_inbound_ca_file"
                  className="font-mono text-xs"
                  value={value('tls_inbound_ca_file')}
                  onChange={(event) =>
                    setValue.mutate({ key: 'tls_inbound_ca_file', value: event.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* outbound */}
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="tls-verify">{t('broker.tlsOutboundVerify')}</Label>
              <p className="text-xs text-muted-foreground">{t('broker.tlsOutboundVerifyHint')}</p>
            </div>
            <Switch
              id="tls-verify"
              checked={isOn('tls_outbound_verify')}
              onCheckedChange={(checked) =>
                setValue.mutate({ key: 'tls_outbound_verify', value: checked ? 'true' : 'false' })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('broker.tlsOutboundHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {settingRow('tls_outbound_ca_file', 'broker.setting_tls_outbound_ca_file')}
            {settingRow('tls_outbound_client_cert_file', 'broker.setting_tls_outbound_client_cert_file')}
            {settingRow('tls_outbound_client_key_file', 'broker.setting_tls_outbound_client_key_file')}
            {settingRow('tls_dir', 'broker.setting_tls_dir')}
          </div>
        </div>

        {/* certificate overview */}
        {overview && overview.certificates.length > 0 && (
          <div className="space-y-1" data-testid="tls-certificates">
            <p className="text-xs font-medium">{t('broker.tlsCertificates')}</p>
            <ul className="space-y-1">
              {overview.certificates.map((entry) => (
                <li key={entry.role} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t(`broker.tlsRole_${entry.role}`)}</span>
                  <span className="font-mono">{entry.subject || entry.path}</span>
                  {entry.expired ? (
                    <Badge variant="destructive" className="text-[10px]">{t('broker.tlsExpired')}</Badge>
                  ) : entry.expiring_soon ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {t('broker.tlsExpiresIn', { days: entry.days_left })}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {t('broker.tlsValidDays', { days: entry.days_left })}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* the server validates every value — say so instead of failing silently */}
        {setValue.error && (
          <p role="alert" className="text-xs text-destructive break-words">
            {t('broker.settingRejected', { error: errorMessage(setValue.error) })}
          </p>
        )}

        {/* actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            {t('broker.tlsGenerate')}
          </Button>
        </div>

        {/* endpoint check */}
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium">{t('broker.tlsTestTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('broker.tlsTestHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="tls-test-host">{t('broker.tlsTestHost')}</Label>
              <Input
                id="tls-test-host" className="max-w-[200px] font-mono"
                placeholder="10.0.1.30"
                value={testHost} onChange={(event) => setTestHost(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tls-test-port">{t('broker.tlsTestPort')}</Label>
              <Input
                id="tls-test-port" type="number" className="max-w-[110px] font-mono"
                value={testPort} onChange={(event) => setTestPort(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tls-test-echo">{t('broker.tlsTestEcho')}</Label>
              <Input
                id="tls-test-echo" className="max-w-[150px] font-mono"
                placeholder="PACS_KH"
                value={testEcho} onChange={(event) => setTestEcho(event.target.value.toUpperCase())}
              />
            </div>
            <Button
              size="sm"
              disabled={!testHost || test.isPending}
              onClick={() => test.mutate({
                host: testHost, port: Number(testPort) || 2762,
                echo_aet: testEcho, server_name: testHost,
              }, { onSuccess: (result) => setTestResult(result) })}
            >
              {t('broker.tlsTestRun')}
            </Button>
          </div>
          {testResult && (
            <div className="rounded-md border p-2 text-xs" data-testid="tls-test-result">
              <p className={testResult.ok ? 'text-green-600' : 'text-destructive'}>
                {testResult.ok ? t('broker.tlsTestOk') : t('broker.tlsTestFailed', { error: testResult.error })}
              </p>
              {testResult.ok && (
                <dl className="mt-1 grid gap-1 sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">{t('broker.tlsTestProtocol')}</dt>
                    <dd className="font-mono">{testResult.protocol} · {testResult.cipher}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">{t('broker.tlsTestPeer')}</dt>
                    <dd className="truncate font-mono">{testResult.peer_subject || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">{t('broker.tlsTestExpiry')}</dt>
                    <dd className="font-mono">{testResult.peer_not_after?.slice(0, 10) || '—'}</dd>
                  </div>
                  {testResult.echo_ok !== null && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">{t('broker.tlsTestEchoResult')}</dt>
                      <dd className={testResult.echo_ok ? 'text-green-600' : 'text-destructive'}>
                        {testResult.echo_ok ? t('broker.tlsTestEchoOk') : testResult.echo_error}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* generate a self-signed certificate */}
      <Dialog open={showGenerate} onOpenChange={(open) => { setShowGenerate(open); if (!open) setGenerated(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('broker.tlsGenerateTitle')}</DialogTitle>
            <DialogDescription>{t('broker.tlsGenerateHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="tls-cn">{t('broker.tlsGenerateCn')}</Label>
              <Input id="tls-cn" className="font-mono" value={cn}
                     onChange={(event) => setCn(event.target.value)} />
              <p className="text-xs text-muted-foreground">{t('broker.tlsGenerateCnHint')}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tls-days">{t('broker.tlsGenerateDays')}</Label>
              <Input id="tls-days" type="number" className="font-mono" value={days}
                     onChange={(event) => setDays(event.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="tls-san">{t('broker.tlsGenerateSan')}</Label>
              <Input id="tls-san" className="font-mono" value={san}
                     placeholder="10.0.1.47, mwl-broker.hospital.local"
                     onChange={(event) => setSan(event.target.value)} />
              <p className="text-xs text-muted-foreground">{t('broker.tlsGenerateSanHint')}</p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <div>
                <Label htmlFor="tls-ca">{t('broker.tlsGenerateCa')}</Label>
                <p className="text-xs text-muted-foreground">{t('broker.tlsGenerateCaHint')}</p>
              </div>
              <Switch id="tls-ca" checked={isCa} onCheckedChange={setIsCa} />
            </div>
          </div>
          {generated && (
            <div className="space-y-1">
              <p className="text-sm text-green-600">
                {t('broker.tlsGenerateDone', { path: generated.certificate_path })}
              </p>
              <Textarea
                readOnly
                aria-label={t('broker.tlsGeneratePem')}
                className="min-h-[140px] font-mono text-[10px]"
                value={generated.certificate_pem}
              />
              <p className="text-xs text-muted-foreground">{t('broker.tlsGenerateHandOver')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGenerate(false); setGenerated(null); }}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
            <Button
              disabled={!cn || generate.isPending}
              onClick={() => generate.mutate({
                common_name: cn, days: Number(days) || 3650,
                san: san.split(',').map((item) => item.trim()).filter(Boolean),
                is_ca: isCa, filename: 'mwl-broker',
              }, { onSuccess: (result) => setGenerated(result) })}
            >
              {t('broker.tlsGenerateRun')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
