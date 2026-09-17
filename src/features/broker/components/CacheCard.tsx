/**
 * Worklist cache card — the outage bridge at a glance.
 *
 * Shows per source how many items are cached, how old the snapshot is and
 * whether an outage could still be bridged. The semantics (upstream is the
 * source of truth, bounded stale window) are explained inline, because an
 * operator has to know that the cache never keeps a completed order alive.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Database, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { CONFIG_KEYS, useAuditedMutation } from '../hooks/use-broker-writes';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

function formatAge(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

export function CacheCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const [confirmClear, setConfirmClear] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['broker', 'cache'],
    queryFn: () => brokerApi.cache.stats(),
    enabled: configured,
    refetchInterval: 15000,
  });

  const clearCache = useAuditedMutation({
    action: 'broker.cache.clear',
    resourceType: 'brokerConfig',
    run: () => brokerApi.cache.clear(),
    resourceId: () => 'all',
    invalidate: [['broker', 'cache'], ...CONFIG_KEYS],
  });

  const sources = statsQuery.data ?? [];
  const total = sources.reduce((sum, source) => sum + source.entries, 0);

  return (
    <Card data-testid="broker-cache">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Database className="h-4 w-4" />
          {t('broker.cacheTitle')}
          <Badge variant="outline" className="text-xs">
            {t('broker.cacheEntries', { count: total })}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8"
            aria-label={t('broker.cacheClear')}
            onClick={() => setConfirmClear(true)}
            disabled={total === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t('broker.cacheClear')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t('broker.cacheHint')}</p>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('broker.cacheEmpty')}</p>
        ) : (
          <ul className="divide-y" data-testid="broker-cache-list">
            {sources.map((source) => (
              <li key={source.source_id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium">{source.source_name}</span>
                <Badge
                  variant={source.state === 'available' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {t(`broker.cacheState_${source.state}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('broker.cacheEntries', { count: source.entries })}
                  {' · '}
                  {formatAge(source.age_s)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {source.stale_on_error ? t('broker.cacheStaleOn') : t('broker.cacheStaleOff')}
                  {source.refresh_s > 0 && ` · ${t('broker.cacheRefreshEvery', { seconds: source.refresh_s })}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDeleteDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        itemName={t('broker.cacheTitle')}
        warning={t('broker.cacheClearWarning')}
        pending={clearCache.isPending}
        onConfirm={() => clearCache.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
      />
    </Card>
  );
}
