/**
 * MppsCard — performed procedure steps and whether they reached the RIS.
 *
 * This is the counterpart of the worklist: the modality reports what it did
 * (MPPS), the RIS needs that to close the order. Without this card an operator
 * cannot tell whether the reports actually arrived.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Loader2, Send, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { brokerApi, type MppsStep } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useCanWrite } from '@/features/broker/hooks/use-can-write';
import { useAuditedMutation } from '@/features/broker/hooks/use-broker-writes';

export function MppsCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const queryClient = useQueryClient();
  const { canWrite } = useCanWrite();
  const [showAll, setShowAll] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['broker', 'mpps', 'stats'],
    queryFn: () => brokerApi.mpps.stats(),
    enabled: configured,
    refetchInterval: 15000,
  });
  const stepsQuery = useQuery({
    queryKey: ['broker', 'mpps', 'list'],
    queryFn: () => brokerApi.mpps.list(20),
    enabled: configured && showAll,
    refetchInterval: 15000,
  });
  const retry = useAuditedMutation({
    action: 'broker.mpps.forward',
    resourceType: 'brokerConfig',
    resourceId: () => undefined,
    run: () => brokerApi.mpps.forwardPending(),
    invalidate: [['broker', 'mpps']],
    successMessage: t('broker.mppsForwarded'),
  });

  const retryOne = useAuditedMutation<number, { ok: boolean; error: string }>({
    action: 'broker.mpps.forward_one',
    resourceType: 'brokerConfig',
    resourceId: (id) => String(id),
    run: (id) => brokerApi.mpps.forward(id),
    invalidate: [['broker', 'mpps']],
    successMessage: t('broker.mppsForwarded'),
  });

  const stats = statsQuery.data;
  const steps = stepsQuery.data ?? [];

  return (
    <Card data-testid="broker-mpps">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('broker.mppsTitle')}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t('broker.mppsHint')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAll((open) => !open)}>
          {showAll ? t('broker.mppsHideList') : t('broker.mppsShowList')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{t('broker.mppsTotal', { count: stats.total })}</Badge>
            <Badge variant={stats.pending_forward > 0 ? 'destructive' : 'outline'}>
              {t('broker.mppsPending', { count: stats.pending_forward })}
            </Badge>
            <Badge variant="outline">{t('broker.mppsForwardedCount', { count: stats.forwarded })}</Badge>
            {!stats.forward_enabled && (
              <span className="text-muted-foreground">{t('broker.mppsForwardOff')}</span>
            )}
            {Object.keys(stats.by_modality ?? {}).length > 1 && (
              <span className="text-muted-foreground">
                {t('broker.mppsByModality')}:{' '}
                {Object.entries(stats.by_modality).map(([modality, count]) => (
                  <span key={modality} className="font-mono mr-2">{modality} {count}</span>
                ))}
              </span>
            )}
            {stats.hide_completed && (
              <span className="text-muted-foreground">{t('broker.mppsHideCompleted')}</span>
            )}
          </div>
        )}

        {stats?.last_error && (
          <p role="alert" className="text-xs text-destructive flex items-center gap-1">
            <TriangleAlert className="h-3 w-3" />
            {t('broker.mppsLastError', { error: stats.last_error })}
          </p>
        )}

        {canWrite && stats && stats.pending_forward > 0 && (
          <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate(undefined)}>
            {retry.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Send className="h-4 w-4 mr-1" />}
            {t('broker.mppsRetry')}
          </Button>
        )}

        {showAll && (
          <div className="overflow-x-auto">
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('broker.mppsEmpty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('broker.mppsWhen')}</TableHead>
                    <TableHead>{t('broker.accession')}</TableHead>
                    <TableHead>{t('broker.modality')}</TableHead>
                    <TableHead>{t('broker.station')}</TableHead>
                    <TableHead>{t('broker.mppsStatus')}</TableHead>
                    <TableHead>{t('broker.mppsDelivery')}</TableHead>
                    <TableHead className="w-[120px] text-right">{t('broker.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steps.map((step: MppsStep) => (
                    <TableRow key={step.id}>
                      <TableCell className="text-xs">
                        {new Date(step.ts).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{step.accession || '—'}</TableCell>
                      <TableCell className="text-xs">{step.modality || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{step.station_aet || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={step.status === 'COMPLETED' ? 'secondary' : 'outline'}
                               className="text-[10px]">
                          {t(`broker.mppsState_${step.status}`, { defaultValue: step.status })}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {step.forwarded
                          ? t('broker.mppsDelivered')
                          : step.forward_error
                            ? <span className="text-destructive">{step.forward_error}</span>
                            : t('broker.mppsPendingShort')}
                      </TableCell>
                      {/* Ein einzelner hängender Schritt braucht eine eigene Aktion:
                          "alle nachmelden" hilft nicht, wenn genau einer abgelehnt wird. */}
                      <TableCell className="text-right">
                        {canWrite && !step.forwarded && (
                          <Button
                            size="sm"
                            variant="outline"
                            title={t('broker.mppsRetryOneHint')}
                            aria-label={t('broker.mppsRetryOne')}
                            disabled={retryOne.isPending}
                            onClick={() => retryOne.mutate(step.id)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {t('broker.mppsRetryOne')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
