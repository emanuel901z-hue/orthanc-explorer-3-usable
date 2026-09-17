/**
 * Alerting card — webhook, subscribed events and a test message.
 *
 * The generic settings list renders one row per key, which is the wrong shape
 * for "pick the events you care about". This card groups the three alerting
 * settings and offers the check the operator actually needs after setting it
 * up: send a test message and see whether the webhook accepted it.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { brokerApi, type BrokerSetting } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useBrokerSettingWrites } from '../hooks/use-broker-writes';

const SEVERITY_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  error: 'destructive',
  warning: 'secondary',
  info: 'outline',
};

export function NotificationsCard({ settings }: { settings: BrokerSetting[] }) {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const { setValue, reset } = useBrokerSettingWrites();

  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const urlSetting = byKey.get('notify_webhook_url');
  const eventsSetting = byKey.get('notify_events');
  const intervalSetting = byKey.get('notify_min_interval_s');

  const [url, setUrl] = useState(urlSetting?.value ?? '');
  const [interval, setInterval] = useState(intervalSetting?.value ?? '300');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((eventsSetting?.value ?? '').split(',').map((c) => c.trim()).filter(Boolean)),
  );
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => setUrl(urlSetting?.value ?? ''), [urlSetting?.value]);
  useEffect(() => setInterval(intervalSetting?.value ?? '300'), [intervalSetting?.value]);
  useEffect(() => {
    setSelected(new Set((eventsSetting?.value ?? '').split(',').map((c) => c.trim()).filter(Boolean)));
  }, [eventsSetting?.value]);

  const eventsQuery = useQuery({
    queryKey: ['broker', 'notify', 'events'],
    queryFn: brokerApi.notify.events,
    enabled: configured,
    staleTime: 300_000,
  });

  const pending = setValue.isPending || reset.isPending;
  const events = eventsQuery.data ?? [];
  const value = (key: string) => byKey.get(key)?.value ?? '';
  const source = (key: string) => byKey.get(key)?.source ?? 'env';
  const dirty = (key: string, draft: string) => draft !== value(key);

  const toggleEvent = (code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const saveEvents = () => {
    setValue.mutate({ key: 'notify_events', value: [...selected].sort().join(',') });
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await brokerApi.notify.test());
    } catch (error) {
      setTestResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card data-testid="notify-card">
      <CardContent className="p-3 sm:p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <BellRing className="h-4 w-4" />
          <span className="text-sm font-medium">{t('broker.notifyTitle')}</span>
          {url ? (
            <Badge variant="secondary" className="text-xs">{t('broker.notifyActive')}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t('broker.notifyInactive')}</Badge>
          )}
          <span className="text-xs text-muted-foreground">{t('broker.notifyHint')}</span>
        </div>

        {/* webhook URL */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="notify-url">{t('broker.notifyUrl')}</Label>
            <Badge variant={source('notify_webhook_url') === 'db' ? 'secondary' : 'outline'}
                   className="text-xs">
              {source('notify_webhook_url') === 'db'
                ? t('broker.settingOverridden') : t('broker.settingFromEnv')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="notify-url"
              className="max-w-md font-mono"
              value={url}
              placeholder="https://hooks.slack.com/services/…"
              onChange={(event) => setUrl(event.target.value)}
            />
            <Button
              size="sm"
              disabled={pending || !dirty('notify_webhook_url', url)}
              onClick={() => setValue.mutate({ key: 'notify_webhook_url', value: url })}
            >
              {t('broker.save')}
            </Button>
            {source('notify_webhook_url') === 'db' && (
              <Button
                variant="ghost" size="sm"
                aria-label={t('broker.settingReset')}
                disabled={pending}
                onClick={() => reset.mutate('notify_webhook_url')}
              >
                {t('broker.settingReset')}
              </Button>
            )}
          </div>
        </div>

        {/* events */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t('broker.notifyEvents')}</Label>
            <Badge variant={source('notify_events') === 'db' ? 'secondary' : 'outline'}
                   className="text-xs">
              {source('notify_events') === 'db'
                ? t('broker.settingOverridden') : t('broker.settingFromEnv')}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="notify-events">
            {events.map((event) => (
              <label
                key={event.code}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  aria-label={event.code}
                  checked={selected.has(event.code)}
                  onChange={() => toggleEvent(event.code)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{event.code}</span>
                    <Badge variant={SEVERITY_VARIANT[event.severity] ?? 'outline'}
                           className="text-[10px]">
                      {event.severity}
                    </Badge>
                  </span>
                  <span className="block text-xs text-muted-foreground">{event.description}</span>
                </span>
              </label>
            ))}
          </div>
          <Button
            size="sm"
            disabled={pending || [...selected].sort().join(',') === value('notify_events')}
            onClick={saveEvents}
          >
            {t('broker.save')}
          </Button>
        </div>

        {/* de-bounce + test */}
        <div className="space-y-1">
          <Label htmlFor="notify-interval">{t('broker.notifyInterval')}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="notify-interval"
              type="number"
              min={0}
              max={86400}
              className="max-w-[140px] font-mono"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
            <Button
              size="sm"
              disabled={pending || !dirty('notify_min_interval_s', interval)}
              onClick={() => setValue.mutate({ key: 'notify_min_interval_s', value: interval })}
            >
              {t('broker.save')}
            </Button>
            <Button variant="outline" size="sm" disabled={testing} onClick={runTest}>
              <Send className="h-4 w-4 mr-1" />
              {testing ? t('broker.notifyTesting') : t('broker.notifyTest')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('broker.notifyIntervalHint')}</p>
          {testResult && (
            <p
              role="status"
              data-testid="notify-test-result"
              className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}
            >
              {testResult.ok
                ? t('broker.notifyTestOk')
                : t('broker.notifyTestFailed', { error: testResult.error })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
