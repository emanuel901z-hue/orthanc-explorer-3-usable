/**
 * RetentionCard — the deletion concept, visible and configurable.
 *
 * The operator sees per table how many rows there are, how old the oldest is
 * and what the configured retention is — and can run the cleanup from here
 * instead of waiting for the periodic tick. "Keep forever" is stated as such,
 * so nothing is ever deleted implicitly.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Eraser } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { CONFIG_KEYS, useAuditedMutation } from '../hooks/use-broker-writes';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

const RETENTION_KEYS = [...CONFIG_KEYS, ['broker', 'retention']];

function formatAge(iso: string | null): string {
  if (!iso) return '—';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 5400 * 24) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export function RetentionCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState<number | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['broker', 'retention'],
    queryFn: brokerApi.retention.overview,
    enabled: configured,
    refetchInterval: 60000,
  });

  const purge = useAuditedMutation({
    action: 'broker.retention.purge',
    resourceType: 'brokerConfig',
    run: () => brokerApi.retention.purge(),
    resourceId: () => 'all',
    invalidate: [...CONFIG_KEYS, ['broker', 'retention']],
  });

  const tables = overviewQuery.data?.tables ?? [];
  const deletable = tables.reduce((sum, entry) => sum + entry.will_delete, 0);

  return (
    <Card data-testid="retention-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Eraser className="h-4 w-4" />
          {t('broker.retentionTitle')}
          <Button
            variant="ghost" size="sm" className="ml-auto h-8"
            aria-label={t('broker.retentionPurge')}
            disabled={deletable === 0 || purge.isPending}
            onClick={() => setConfirm(true)}
          >
            <Eraser className="h-4 w-4 mr-1" />
            {t('broker.retentionPurge')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t('broker.retentionHint')}</p>
        <ul className="divide-y" data-testid="retention-tables">
          {tables.map((entry) => (
            <li key={entry.table} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-medium">
                {t(`broker.retentionTable_${entry.table}`, { defaultValue: entry.description })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('broker.retentionRows', { rows: entry.rows })}
                {entry.oldest
                  ? ` · ${t('broker.retentionOldest', { age: formatAge(entry.oldest) })}`
                  : ''}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {entry.retention_days === 0 ? (
                  <Badge variant="outline" className="text-xs">
                    {t('broker.retentionForever')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {t('broker.retentionDays', { days: entry.retention_days })}
                  </Badge>
                )}
                {entry.will_delete > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {t('broker.retentionWillDelete', { count: entry.will_delete })}
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
        {deleted !== null && (
          <p role="status" data-testid="retention-purge-result" className="text-sm text-green-600">
            {t('broker.retentionDeleted', { count: deleted })}
          </p>
        )}
      </CardContent>

      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        itemName={t('broker.retentionPurge')}
        warning={t('broker.retentionPurgeWarning')}
        pending={purge.isPending}
        onConfirm={() => purge.mutate(undefined, { onSuccess: (result) => {
          setConfirm(false);
          setDeleted(result.total);
        } })}
      />
    </Card>
  );
}
