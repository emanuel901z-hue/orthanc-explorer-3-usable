/**
 * BrokerPage — MWL broker dashboard (read-only phase).
 *
 * Shows SCP/DB health, echo matrix for sources + targets (5s polling),
 * counters, and the live C-FIND query log. Source/target/rule editors are
 * a later phase — the API client (src/api/broker.ts) already covers CRUD.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RadioTower,
  Loader2,
  Database,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { format } from 'date-fns';
import { EchoBadge } from '../components/EchoBadge';
import { BreakerBadge } from '../components/BreakerBadge';
import { HealthPanel } from '../components/HealthPanel';
import { CaseCheckPanel } from '../components/CaseCheckPanel';
import { CacheCard } from '../components/CacheCard';
import { InstancesCard } from '../components/InstancesCard';
import { MppsCard } from '../components/MppsCard';
import { StatsCard } from '../components/StatsCard';
import { SpoolCard } from '../components/SpoolCard';
import { RbacBanner } from '../components/RbacBanner';
import { PageHelp } from '../components/PageHelp';
import { useBrokerSourceWrites } from '../hooks/use-broker-writes';

/** Seconds → "3 d 4 h", "12 min" — what an operator reads at a glance. */
function formatUptime(seconds?: number): string {
  if (seconds === undefined) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days} d ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${seconds} s`;
}

export default function BrokerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const brokerConfigured = Boolean(getConfig().brokerUrl);

  const statusQuery = useQuery({
    queryKey: ['broker', 'status'],
    queryFn: () => brokerApi.status(),
    enabled: brokerConfigured,
    refetchInterval: 5000,
  });

  // "show me yesterday's failures": the API filters by date, so the operator
  // does not have to page through weeks of log lines
  const [logSince, setLogSince] = useState('');
  const queriesQuery = useQuery({
    queryKey: ['broker', 'queries', logSince],
    queryFn: () => brokerApi.logs.queries({ limit: 50, ...(logSince ? { since: logSince } : {}) }),
    enabled: brokerConfigured,
    refetchInterval: 5000,
  });
  // Die andere Hälfte der Nachvollziehbarkeit: was der Broker **ausgeliefert**
  // hat. Das Abfrageprotokoll allein beantwortet "kam das Bild an?" nicht.
  const storesQuery = useQuery({
    queryKey: ['broker', 'stores', logSince],
    queryFn: () => brokerApi.logs.stores({ limit: 50, ...(logSince ? { since: logSince } : {}) }),
    enabled: brokerConfigured,
    refetchInterval: 5000,
  });

  const sourcesQuery = useQuery({
    queryKey: ['broker', 'sources'],
    queryFn: () => brokerApi.sources.list(),
    enabled: brokerConfigured,
  });

  const targetsQuery = useQuery({
    queryKey: ['broker', 'targets'],
    queryFn: () => brokerApi.targets.list(),
    enabled: brokerConfigured,
  });

  const healthQuery = useQuery({
    queryKey: ['broker', 'health'],
    queryFn: () => brokerApi.health.config(),
    enabled: brokerConfigured,
    refetchInterval: 30000,
  });

  const { resetBreaker } = useBrokerSourceWrites();

  const echoMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: 'source' | 'target'; id: number }) =>
      kind === 'source' ? brokerApi.sources.echo(id) : brokerApi.targets.echo(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['broker', 'status'] }),
  });

  if (!brokerConfigured) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <RadioTower className="h-6 w-6" />
          {t('broker.title')}
        </h1>
        <Card className="mt-4 border-warning/30 bg-warning/5">
          <CardContent className="p-3 text-sm text-warning">
            {t('broker.notConfigured')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusQuery.data;
  const queryLogs = queriesQuery.data ?? [];
  const storeLogs = storesQuery.data ?? [];
  const sourceById = new Map((sourcesQuery.data ?? []).map((s) => [s.id, s]));
  const targetById = new Map((targetsQuery.data ?? []).map((t2) => [t2.id, t2]));

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RadioTower className="h-6 w-6" />
            {t('broker.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('broker.subtitle')}</p>
        </div>
        <PageHelp helpId="overview" />
      </div>

      {statusQuery.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive">
            {t('broker.loadError')}
          </CardContent>
        </Card>
      )}

      {(() => {
        const stale = (queriesQuery.data ?? [])[0]?.served_stale ?? [];
        if (stale.length === 0) return null;
        return (
          <Card className="border-amber-500/40 bg-amber-500/5" data-testid="broker-stale-banner">
            <CardContent className="p-3 text-sm text-amber-700">
              {t('broker.staleBanner', { sources: stale.join(', ') })}
            </CardContent>
          </Card>
        );
      })()}

      <HealthPanel
        health={healthQuery.data}
        onNavigate={(path) => navigate(path)}
      />

      <CaseCheckPanel />

      <RbacBanner />


      <SpoolCard />

      <InstancesCard />

      <CacheCard />

      <MppsCard />

      <StatsCard />

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Activity className={`h-4 w-4 ${status?.scp_listening ? 'text-green-600' : 'text-destructive'}`} />
            <div>
              <p className="text-xs text-muted-foreground">{t('broker.scp')}</p>
              <p className="text-sm font-medium">
                {status?.scp_listening ? t('broker.listening') : t('broker.down')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Database className={`h-4 w-4 ${status?.db_ok ? 'text-green-600' : 'text-destructive'}`} />
            <div>
              <p className="text-xs text-muted-foreground">{t('broker.db')}</p>
              <p className="text-sm font-medium">
                {status?.db_ok ? 'OK' : t('broker.down')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('broker.cfindTotal')}</p>
            <p className="text-lg font-semibold">{status?.counts.queries ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('broker.cstoreTotal')}</p>
            <p className="text-lg font-semibold">{status?.counts.stores ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* which build is this? (an operator asks exactly that) */}
      <Card data-testid="broker-build">
        <CardContent className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t('broker.buildVersion')}: <span className="font-medium text-foreground">{status?.version ?? '—'}</span>
          </span>
          <span>
            {t('broker.uptime')}: <span className="font-medium text-foreground">
              {formatUptime(status?.uptime_s)}
            </span>
          </span>
          {status?.started_at && (
            <span>{t('broker.startedAt')}: {new Date(status.started_at).toLocaleString()}</span>
          )}
        </CardContent>
      </Card>

      {/* Sources + targets */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('broker.sources')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.name')}</TableHead>
                  <TableHead>{t('broker.endpoint')}</TableHead>
                  <TableHead className="w-[140px]">{t('broker.echo')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(status?.sources ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.name}
                      {sourceById.get(s.id)?.enabled === false && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {t('broker.disabled')}
                        </Badge>
                      )}
                      <span className="ml-2 inline-block align-middle">
                        <BreakerBadge
                          state={s.breaker_state}
                          retryInS={s.breaker_retry_in_s}
                          pending={resetBreaker.isPending}
                          onReset={() => resetBreaker.mutate(s.id)}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs break-all">
                      {(() => {
                        const cfg = sourceById.get(s.id);
                        return cfg ? `${cfg.aet}@${cfg.host}:${cfg.port}` : '—';
                      })()}
                    </TableCell>
                    <TableCell>
                      <EchoBadge
                        echo={s}
                        pending={echoMutation.isPending}
                        onEcho={() => echoMutation.mutate({ kind: 'source', id: s.id })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(status?.sources ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">
                      {t('broker.noSources')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('broker.targets')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.name')}</TableHead>
                  <TableHead>{t('broker.endpoint')}</TableHead>
                  <TableHead className="w-[140px]">{t('broker.echo')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(status?.targets ?? []).map((tg) => (
                  <TableRow key={tg.id}>
                    <TableCell className="font-medium">
                      {tg.name}
                      {targetById.get(tg.id)?.is_default && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {t('broker.defaultTarget')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs break-all">
                      {(() => {
                        const cfg = targetById.get(tg.id);
                        return cfg ? `${cfg.aet}@${cfg.host}:${cfg.port}` : '—';
                      })()}
                    </TableCell>
                    <TableCell>
                      <EchoBadge
                        echo={tg}
                        pending={echoMutation.isPending}
                        onEcho={() => echoMutation.mutate({ kind: 'target', id: tg.id })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(status?.targets ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">
                      {t('broker.noTargets')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Live query log */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('broker.recentQueries')}</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="log-since" className="text-xs text-muted-foreground whitespace-nowrap">
              {t('broker.sinceLabel')}
            </Label>
            <Input
              id="log-since"
              type="date"
              className="h-9 w-[150px]"
              value={logSince}
              onChange={(event) => setLogSince(event.target.value)}
              aria-describedby="log-since-hint"
            />
            <span id="log-since-hint" className="sr-only">{t('broker.sinceHint')}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {queriesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queryLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t('broker.noQueries')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.time')}</TableHead>
                  <TableHead>{t('broker.callingAet')}</TableHead>
                  <TableHead>{t('broker.answers')}</TableHead>
                  <TableHead>{t('broker.perSource')}</TableHead>
                  <TableHead>{t('broker.duration')}</TableHead>
                  <TableHead>{t('broker.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queryLogs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(row.ts), 'dd.MM. HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.calling_aet}</TableCell>
                    <TableCell>{row.answers}</TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(row.per_source).map(([name, value]) => (
                        <span key={name} className="mr-2 inline-flex items-center gap-1">
                          {name}:
                          {(row.served_stale ?? []).includes(name) && (
                            <Badge variant="outline" className="text-[10px] text-amber-600">
                              {t('broker.staleBadge')}
                            </Badge>
                          )}
                          {value === 'breaker_open' ? (
                            <Badge variant="outline" className="text-[10px] text-amber-600">
                              {t('broker.breakerSkipped')}
                            </Badge>
                          ) : (
                            <span>{String(value)}</span>
                          )}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs">{row.duration_ms} ms</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'success' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {t(`broker.queryStatus_${row.status}`, { defaultValue: row.status })}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card data-testid="broker-store-log">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('broker.storeLogTitle')}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t('broker.storeLogHint')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {storesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : storeLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t('broker.storeLogEmpty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.time')}</TableHead>
                  <TableHead>{t('broker.callingAet')}</TableHead>
                  <TableHead>{t('broker.accession')}</TableHead>
                  <TableHead>{t('broker.status')}</TableHead>
                  <TableHead>{t('broker.storeLogError')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeLogs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(row.ts), 'dd.MM. HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.calling_aet}</TableCell>
                    <TableCell className="font-mono text-xs">{row.accession || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'success' ? 'secondary' : 'outline'}
                        className="text-[10px]"
                      >
                        {t(`broker.storeStatus_${row.status}`, { defaultValue: row.status })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-destructive">{row.error || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
