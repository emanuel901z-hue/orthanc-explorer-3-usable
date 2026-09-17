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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { brokerApi, type BrokerSetting } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { NotificationsCard } from '../components/NotificationsCard';
import { useBrokerSettingWrites } from '../hooks/use-broker-writes';

const isTrue = (value: string) => ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());

function SettingRow({ setting }: { setting: BrokerSetting }) {
  const { t } = useTranslation();
  const { setValue, reset } = useBrokerSettingWrites();
  const [draft, setDraft] = useState(setting.value);
  const pending = setValue.isPending || reset.isPending;

  useEffect(() => setDraft(setting.value), [setting.value]);

  const dirty = draft !== setting.value;
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
          ) : (
            <>
              <Input
                id={`setting-${setting.key}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="max-w-md font-mono text-sm"
                placeholder={setting.default || t('broker.settingEmpty')}
              />
              <Button
                size="sm"
                disabled={pending || !dirty}
                onClick={() => setValue.mutate({ key: setting.key, value: draft })}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {t('common.save', { defaultValue: 'Save' })}
              </Button>
            </>
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
  const generic = all.filter((setting) => !notifyKeys.has(setting.key));

  return (
    <BrokerPageShell
      titleKey="broker.settingsTitle"
      subtitleKey="broker.settingsSubtitle"
    >
      <div className="space-y-3">
        {all.length > 0 && <NotificationsCard settings={all} />}
        {generic.map((setting) => (
          <SettingRow key={setting.key} setting={setting} />
        ))}
      </div>
    </BrokerPageShell>
  );
}
