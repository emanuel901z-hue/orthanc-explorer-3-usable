/**
 * InstancesCard — "who is running?" (high availability).
 *
 * Two broker instances may share the database and the spool volume (docs/ha.md).
 * The card answers the three questions an operator actually has:
 *
 *  * which instance is answering *me* right now?
 *  * which other instances are alive — and did one disappear?
 *  * what do I have to check when more than one is running? (the spool volume is
 *    shared, and the modalities must reach the *active* instance through a VIP or
 *    load balancer — the broker cannot see either, so it says so instead of
 *    pretending everything is fine)
 *
 * A single instance is the normal case and must not look like a warning.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Server, ServerOff, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';

function formatAge(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

export function InstancesCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);

  const statusQuery = useQuery({
    queryKey: ['broker', 'status'],
    queryFn: () => brokerApi.status(),
    enabled: configured,
    refetchInterval: 10000,
  });

  const status = statusQuery.data;
  const instances = status?.instances ?? [];
  const active = status?.instances_active ?? 0;

  return (
    <Card data-testid="broker-instances">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Server className="h-4 w-4" />
          {t('broker.haTitle')}
          <Badge variant={active > 1 ? 'secondary' : 'outline'} className="text-xs"
                 data-testid="ha-active-count">
            {t('broker.haActive', { count: active })}
          </Badge>
          {status?.instance_id && (
            <span className="ml-auto font-mono text-xs text-muted-foreground"
                  data-testid="ha-current-instance">
              {status.instance_id}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t('broker.haHint')}</p>

        {active > 1 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2"
               role="status" data-testid="ha-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs">{t('broker.haWarning')}</p>
          </div>
        )}

        <ul className="divide-y" data-testid="ha-instance-list">
          {instances.map((instance) => (
            <li key={instance.instance_id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
              {instance.active ? (
                <Server className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <ServerOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="font-mono">{instance.instance_id}</span>
              {instance.current && (
                <Badge variant="outline" className="text-[10px]">{t('broker.haThisOne')}</Badge>
              )}
              <Badge variant={instance.active ? 'secondary' : 'destructive'} className="text-[10px]">
                {instance.active ? t('broker.haAlive') : t('broker.haGone')}
              </Badge>
              <span className="text-muted-foreground">
                {t('broker.haLastSeen', { age: formatAge(instance.age_s) })}
              </span>
              {instance.version && (
                <span className="ml-auto text-muted-foreground">
                  {instance.version}
                  {instance.hostname ? ` · ${instance.hostname}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>

        {instances.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('broker.haEmpty')}</p>
        )}
      </CardContent>
    </Card>
  );
}
