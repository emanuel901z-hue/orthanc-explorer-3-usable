/**
 * C-STORE spool card — the store-and-forward backlog at a glance.
 *
 * An instance that cannot be forwarded is spooled instead of lost. The card
 * shows the backlog, the oldest entry and how full the spool is, and offers
 * the operator's bulk action ("retry all") after a PACS outage.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { HardDriveDownload, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useNavigate } from 'react-router-dom';
import { CONFIG_KEYS, useAuditedMutation } from '../hooks/use-broker-writes';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

const SPOOL_KEYS = [...CONFIG_KEYS, ['broker', 'spool']];

function formatAge(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function SpoolCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const configured = Boolean(getConfig().brokerUrl);
  const [confirmRetryAll, setConfirmRetryAll] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['broker', 'spool', 'stats'],
    queryFn: () => brokerApi.spool.stats(),
    enabled: configured,
    refetchInterval: 10000,
  });

  const retryAll = useAuditedMutation({
    action: 'broker.spool.retry_all',
    resourceType: 'brokerConfig',
    run: () => brokerApi.spool.retryAll(),
    resourceId: () => 'all',
    invalidate: SPOOL_KEYS,
  });

  const stats = statsQuery.data;
  const dead = stats?.dead ?? 0;
  const open = stats?.open ?? 0;

  return (
    <Card data-testid="broker-spool">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <HardDriveDownload className="h-4 w-4" />
          {t('broker.spoolTitle')}
          {dead > 0 ? (
            <Badge variant="destructive" className="text-xs">
              {t('broker.spoolDead', { count: dead })}
            </Badge>
          ) : open > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {t('broker.spoolOpen', { count: open })}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t('broker.spoolEmpty')}</Badge>
          )}
          {stats?.capacity.full && (
            <Badge variant="destructive" className="text-xs">{t('broker.spoolFull')}</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8"
            aria-label={t('broker.spoolRetryAll')}
            disabled={(dead + (stats?.failed ?? 0)) === 0 || retryAll.isPending}
            onClick={() => setConfirmRetryAll(true)}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('broker.spoolRetryAll')}
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => navigate('/broker/spool')}>
            {t('broker.spoolOpenPage')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t('broker.spoolHint')}</p>
        <ul className="divide-y" data-testid="broker-spool-stats">
          <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="text-muted-foreground">{t('broker.spoolBacklog')}</span>
            <span className="font-medium">{open}</span>
            <span className="text-xs text-muted-foreground">
              {t('broker.spoolOldest', { age: formatAge(stats?.oldest_age_s ?? null) })}
              {' · '}
              {formatBytes(stats?.bytes ?? 0)}
            </span>
            {(stats?.claimed ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="spool-claimed">
                {t('broker.spoolClaimed', { count: stats?.claimed ?? 0 })}
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {t('broker.spoolUsage', {
                items: stats?.capacity.items ?? 0,
                max: stats?.capacity.max_items ?? 0,
              })}
            </span>
          </li>
        </ul>
      </CardContent>

      <ConfirmDeleteDialog
        open={confirmRetryAll}
        onOpenChange={setConfirmRetryAll}
        itemName={t('broker.spoolRetryAll')}
        warning={t('broker.spoolRetryAllWarning')}
        pending={retryAll.isPending}
        onConfirm={() => retryAll.mutate(undefined, { onSuccess: () => setConfirmRetryAll(false) })}
      />
    </Card>
  );
}
