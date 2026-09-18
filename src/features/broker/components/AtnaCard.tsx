/**
 * AtnaCard — the IHE audit trail to the hospital's own repository.
 *
 * Sending audit messages off-box is an explicit opt-in, so the card leads with
 * the state (off / configured / buffer) and offers the two things the operator
 * needs: a test message and the sample XML, which is what the team running the
 * Audit Record Repository will ask for first.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FileCode2, Send, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { brokerApi, type BrokerSetting } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { errorMessage, useBrokerSettingWrites } from '../hooks/use-broker-writes';

const KEYS = [
  'atna_enabled', 'atna_syslog_host', 'atna_syslog_port', 'atna_syslog_protocol',
  'atna_tls_ca_file', 'atna_queue_max',
];

export function AtnaCard({ settings }: { settings: BrokerSetting[] }) {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const { setValue, reset } = useBrokerSettingWrites();

  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const value = (key: string) => byKey.get(key)?.value ?? '';
  const source = (key: string) => byKey.get(key)?.source ?? 'env';

  const [testResult, setTestResult] = useState<{ ok: boolean; error: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['broker', 'atna'],
    queryFn: brokerApi.atna.stats,
    enabled: configured,
    refetchInterval: 15000,
  });
  const sampleQuery = useQuery({
    queryKey: ['broker', 'atna', 'sample'],
    queryFn: brokerApi.atna.sample,
    enabled: configured && showSample,
    staleTime: 300_000,
  });

  const stats = statsQuery.data;
  const pending = setValue.isPending || reset.isPending;
  const dirty = (key: string, draft: string) => draft !== value(key);
  const enabled = ['true', '1', 'yes', 'on'].includes(value('atna_enabled').toLowerCase());

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await brokerApi.atna.test());
    } catch (error) {
      setTestResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  const field = (key: string, labelKey: string, type = 'text', mono = true) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label htmlFor={key}>{t(labelKey)}</Label>
        <Badge variant={source(key) === 'db' ? 'secondary' : 'outline'} className="text-xs">
          {source(key) === 'db' ? t('broker.settingOverridden') : t('broker.settingFromEnv')}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={key}
          type={type}
          className={mono ? 'max-w-[240px] font-mono' : 'max-w-[240px]'}
          value={value(key)}
          onChange={(event) => setValue.mutate({ key, value: event.target.value })}
          disabled={pending}
        />
      </div>
    </div>
  );

  return (
    <Card data-testid="atna-card">
      <CardContent className="p-3 sm:p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-sm font-medium">{t('broker.atnaTitle')}</span>
          {stats?.configured ? (
            <Badge variant="secondary" className="text-xs">{t('broker.atnaActive')}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t('broker.atnaInactive')}</Badge>
          )}
          {stats && stats.queue_size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {t('broker.atnaQueue', { size: stats.queue_size, max: stats.queue_max })}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{t('broker.atnaHint')}</span>
        </div>

        {/* enable switch */}
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <Label htmlFor="atna-enabled">{t('broker.atnaEnabled')}</Label>
            <p className="text-xs text-muted-foreground">{t('broker.atnaEnabledHint')}</p>
          </div>
          <Button
            id="atna-enabled"
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            disabled={pending}
            aria-pressed={enabled}
            onClick={() => setValue.mutate({ key: 'atna_enabled', value: enabled ? 'false' : 'true' })}
          >
            {enabled ? t('broker.on') : t('broker.off')}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {field('atna_syslog_host', 'broker.setting_atna_syslog_host')}
          {field('atna_syslog_port', 'broker.setting_atna_syslog_port', 'number')}

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="atna_syslog_protocol">{t('broker.setting_atna_syslog_protocol')}</Label>
              <Badge variant={source('atna_syslog_protocol') === 'db' ? 'secondary' : 'outline'}
                     className="text-xs">
                {source('atna_syslog_protocol') === 'db'
                  ? t('broker.settingOverridden') : t('broker.settingFromEnv')}
              </Badge>
            </div>
            <Select
              value={value('atna_syslog_protocol') || 'tcp'}
              onValueChange={(next) => setValue.mutate({ key: 'atna_syslog_protocol', value: next })}
            >
              <SelectTrigger id="atna_syslog_protocol" className="max-w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tcp">tcp</SelectItem>
                <SelectItem value="tls">tls</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('broker.atnaProtocolHint')}</p>
          </div>
          {field('atna_tls_ca_file', 'broker.setting_atna_tls_ca_file')}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={testing} onClick={runTest}>
            <Send className="h-4 w-4 mr-1" />
            {testing ? t('broker.atnaTesting') : t('broker.atnaTest')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSample((open) => !open)}>
            <FileCode2 className="h-4 w-4 mr-1" />
            {t('broker.atnaSample')}
          </Button>
          {KEYS.some((key) => source(key) === 'db') && (
            <Button
              variant="ghost" size="sm"
              aria-label={t('broker.settingReset')}
              disabled={pending}
              onClick={() => KEYS.forEach((key) => {
                if (source(key) === 'db') reset.mutate(key);
              })}
            >
              {t('broker.settingReset')}
            </Button>
          )}
        </div>

        {testResult && (
          <p
            role="status"
            data-testid="atna-test-result"
            className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}
          >
            {testResult.ok
              ? t('broker.atnaTestOk')
              : t('broker.atnaTestFailed', { error: testResult.error })}
          </p>
        )}

        {showSample && (
          <pre
            data-testid="atna-sample"
            className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-[10px] leading-relaxed"
          >
            {sampleQuery.data?.xml ?? t('broker.atnaSampleLoading')}
          </pre>
        )}

        {setValue.error && (
          <p role="alert" className="text-xs text-destructive break-words">
            {t('broker.settingRejected', { error: errorMessage(setValue.error) })}
          </p>
        )}

        {stats && (
          <p className="text-xs text-muted-foreground">
            {t('broker.atnaStats', {
              host: stats.host || '—',
              port: stats.port,
              protocol: stats.protocol,
              size: stats.queue_size,
              max: stats.queue_max,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
