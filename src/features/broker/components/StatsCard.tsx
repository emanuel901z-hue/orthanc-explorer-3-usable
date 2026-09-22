/**
 * StatsCard — how busy the broker was and where it hurt.
 *
 * Derived from the logs the broker already writes (query log, store log, MPPS,
 * spool), so it needs no extra bookkeeping and carries no patient data. The
 * operator picks the period and the dimension; the daily series is drawn as
 * simple bars (no chart library needed for three numbers).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';

const PERIODS = [1, 7, 30, 90] as const;
const DIMENSIONS = ['source', 'modality', 'station'] as const;

export function StatsCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const [days, setDays] = useState<number>(7);
  const [groupBy, setGroupBy] = useState<(typeof DIMENSIONS)[number]>('source');

  const statsQuery = useQuery({
    queryKey: ['broker', 'stats', days, groupBy],
    queryFn: () => brokerApi.statsOverview(days, groupBy),
    enabled: configured,
    refetchInterval: 60000,
  });
  const data = statsQuery.data;

  return (
    <Card data-testid="stats-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {t('broker.statsTitle')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="h-8 w-[110px]" aria-label={t('broker.statsPeriod')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {t('broker.statsDays', { count: value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as typeof groupBy)}>
            <SelectTrigger className="h-8 w-[130px]" aria-label={t('broker.statsGroupBy')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSIONS.map((value) => (
                <SelectItem key={value} value={value}>{t(`broker.statsBy_${value}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data && (
          <>
            <div className="flex flex-wrap gap-2 text-xs" data-testid="stats-totals">
              <Badge variant="secondary">{t('broker.statsQueries', { count: data.totals.queries })}</Badge>
              <Badge variant="outline">{t('broker.statsAnswers', { count: data.totals.answers })}</Badge>
              <Badge variant={data.totals.queries_failed > 0 ? 'destructive' : 'outline'}>
                {t('broker.statsFailed', { count: data.totals.queries_failed })}
              </Badge>
              <Badge variant="outline">{t('broker.statsStores', { count: data.totals.stores })}</Badge>
              <Badge variant={data.totals.stores_failed > 0 ? 'destructive' : 'outline'}>
                {t('broker.statsStoreFailed', { count: data.totals.stores_failed })}
              </Badge>
              <Badge variant="outline">{t('broker.statsAvg', { ms: data.totals.avg_duration_ms })}</Badge>
              {data.totals.spool_open > 0 && (
                <Badge variant="outline">{t('broker.statsSpool', { count: data.totals.spool_open })}</Badge>
              )}
              {data.totals.queries_from_cache > 0 && (
                <Badge variant="outline">{t('broker.statsCache', { count: data.totals.queries_from_cache })}</Badge>
              )}
            </div>

            {/* daily series as plain bars — three numbers need no chart library */}
            <div className="flex items-end gap-[2px] h-16" data-testid="stats-series"
                 aria-label={t('broker.statsSeries')}>
              {data.series.map((day) => {
                const peak = Math.max(1, ...data.series.map((d) => d.queries));
                const height = Math.round((day.queries / peak) * 100);
                return (
                  <div key={day.day} className="flex-1 bg-primary/60 rounded-sm"
                       style={{ height: `${Math.max(2, height)}%` }}
                       title={`${day.day}: ${day.queries} / ${day.stores}`} />
                );
              })}
            </div>

            {data.groups.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t(`broker.statsBy_${data.group_by}`)}</TableHead>
                      <TableHead>{t('broker.statsQueriesShort')}</TableHead>
                      <TableHead>{t('broker.statsAnswersShort')}</TableHead>
                      <TableHead>{t('broker.statsFailedShort')}</TableHead>
                      <TableHead>{t('broker.statsStoresShort')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.groups.slice(0, 10).map((group) => (
                      <TableRow key={group.name}>
                        <TableCell className="font-mono text-xs">{group.name}</TableCell>
                        <TableCell className="text-xs">{group.queries}</TableCell>
                        <TableCell className="text-xs">{group.answers}</TableCell>
                        <TableCell className={`text-xs ${group.queries_failed ? 'text-destructive' : ''}`}>
                          {group.queries_failed}
                        </TableCell>
                        <TableCell className="text-xs">
                          {group.stores}
                          {group.stores_failed > 0 && (
                            <span className="text-destructive"> ({group.stores_failed})</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('broker.statsEmpty')}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
