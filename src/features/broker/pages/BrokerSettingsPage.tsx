/**
 * BrokerSettingsPage — runtime settings (UI override over the ENV default).
 *
 * The deployment `.env` remains the source of truth for defaults; an override
 * written here takes effect without a container restart and can be reset to
 * the ENV value at any time.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { brokerApi, type BrokerSetting } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { NotificationsCard } from '../components/NotificationsCard';
import { AtnaCard } from '../components/AtnaCard';
import { TlsCard } from '../components/TlsCard';
import { RetentionCard } from '../components/RetentionCard';
import { errorMessage, useBrokerSettingWrites } from '../hooks/use-broker-writes';
import { validateSetting } from '../lib/setting-rules';

const isTrue = (value: string) => ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());

function SettingRow({ setting }: { setting: BrokerSetting }) {
  const { t } = useTranslation();
  const { setValue, reset } = useBrokerSettingWrites();
  const [draft, setDraft] = useState(setting.value);
  const pending = setValue.isPending || reset.isPending;

  useEffect(() => setDraft(setting.value), [setting.value]);

  const dirty = draft !== setting.value;
  // the same rules the server applies — the operator sees it before sending
  const draftError = validateSetting(setting, draft);
  const label = t(`broker.setting_${setting.key}`, { defaultValue: setting.key });

  return (
    <Card data-testid={`setting-${setting.key}`}>
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Label htmlFor={`setting-${setting.key}`} className="text-sm font-medium">
                {label}
              </Label>
              <Badge variant={setting.source === 'db' ? 'secondary' : 'outline'} className="text-xs">
                {setting.source === 'db' ? t('broker.settingOverridden') : t('broker.settingFromEnv')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{setting.description}</p>
          </div>

          {setting.source === 'db' && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => reset.mutate(setting.key)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              {t('broker.settingReset')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {setting.kind === 'bool' ? (
            <div className="flex items-center gap-3">
              <Switch
                id={`setting-${setting.key}`}
                checked={isTrue(setting.value)}
                disabled={pending}
                onCheckedChange={(checked) =>
                  setValue.mutate({ key: setting.key, value: checked ? 'true' : 'false' })
                }
              />
              <span className="text-sm text-muted-foreground">
                {isTrue(setting.value) ? t('common.yes', { defaultValue: 'yes' }) : t('common.no', { defaultValue: 'no' })}
              </span>
            </div>
          ) : setting.kind.startsWith('enum:') ? (
            <>
              <Select
                value={draft || setting.choices[0]}
                onValueChange={(next) => setValue.mutate({ key: setting.key, value: next })}
              >
                <SelectTrigger id={`setting-${setting.key}`} className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {setting.choices.map((choice) => (
                    <SelectItem key={choice} value={choice}>{choice}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <Input
                id={`setting-${setting.key}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                type={setting.kind === 'int' ? 'number' : setting.kind === 'url' ? 'url' : 'text'}
                min={setting.kind === 'int' ? setting.min ?? undefined : undefined}
                max={setting.kind === 'int' ? setting.max ?? undefined : undefined}
                aria-invalid={Boolean(draftError) || Boolean(setValue.error) || undefined}
                className="max-w-md font-mono text-sm"
                placeholder={setting.default || t('broker.settingEmpty')}
              />
              <Button
                size="sm"
                disabled={pending || !dirty || Boolean(draftError)}
                onClick={() => setValue.mutate({ key: setting.key, value: draft })}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {t('common.save', { defaultValue: 'Save' })}
              </Button>
              {setting.kind === 'int' && setting.min !== undefined && setting.max !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {t('broker.settingRange', { min: setting.min, max: setting.max })}
                </p>
              )}
            </>
          )}

          {/* caught before sending — the server still has the last word */}
          {draftError && (
            <p role="alert" className="text-xs text-destructive break-words">
              {t('broker.settingInvalid', { error: draftError })}
            </p>
          )}

          {/* the server validates every value — say so instead of failing silently */}
          {setValue.error && (
            <p role="alert" className="text-xs text-destructive break-words">
              {t('broker.settingRejected', { error: errorMessage(setValue.error) })}
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t('broker.settingEnvDefault')}: <span className="font-mono">{setting.default || '—'}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default function BrokerSettingsPage() {
  const configured = Boolean(getConfig().brokerUrl);
  const settingsQuery = useQuery({
    queryKey: ['broker', 'settings'],
    queryFn: brokerApi.settings.list,
    enabled: configured,
  });

  // the alerting keys get their own card (event picker instead of a CSV field)
  const all = settingsQuery.data ?? [];
  const notifyKeys = new Set(['notify_webhook_url', 'notify_events', 'notify_min_interval_s']);
  const atnaKeys = new Set([
    'atna_enabled', 'atna_syslog_host', 'atna_syslog_port', 'atna_syslog_protocol',
    'atna_tls_ca_file', 'atna_queue_max',
  ]);
  const tlsKeys = new Set([
    'tls_inbound_enabled', 'tls_inbound_port', 'tls_inbound_cert_file',
    'tls_inbound_key_file', 'tls_inbound_ca_file', 'tls_inbound_client_auth',
    'tls_outbound_verify', 'tls_outbound_ca_file',
    'tls_outbound_client_cert_file', 'tls_outbound_client_key_file', 'tls_dir',
  ]);
  const generic = all.filter(
    (setting) => !notifyKeys.has(setting.key) && !atnaKeys.has(setting.key)
      && !tlsKeys.has(setting.key),
  );

  return (
    <BrokerPageShell
      titleKey="broker.settingsTitle"
      subtitleKey="broker.settingsSubtitle"
    >
      <div className="space-y-3">
        {all.length > 0 && <NotificationsCard settings={all} />}
        {all.length > 0 && <RetentionCard />}
        {all.length > 0 && <TlsCard settings={all} />}
        {all.length > 0 && <AtnaCard settings={all} />}
        {generic.map((setting) => (
          <SettingRow key={setting.key} setting={setting} />
        ))}
      </div>
    </BrokerPageShell>
  );
}
