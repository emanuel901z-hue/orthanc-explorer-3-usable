/**
 * BrokerPage — MWL broker dashboard (read-only phase).
 *
 * Shows SCP/DB health, echo matrix for sources + targets (5s polling),
 * counters, and the live C-FIND query log. Source/target/rule editors are
 * a later phase — the API client (src/api/broker.ts) already covers CRUD.
 */
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RadioTower,
  Loader2,
  Database,
  Activity,
  CircleCheck,
  CircleX,
  CircleHelp,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { brokerApi, type EchoStatus } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { format } from 'date-fns';

function EchoBadge({ echo, onEcho, pending }: {
  echo: EchoStatus;
  onEcho: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const icon = echo.last_check === null
    ? <CircleHelp className="h-3 w-3" />
    : echo.ok
      ? <CircleCheck className="h-3 w-3" />
      : <CircleX className="h-3 w-3" />;
  const cls = echo.last_check === null
    ? 'text-muted-foreground'
    : echo.ok
      ? 'text-green-600'
      : 'text-destructive';
  return (
    <span className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${cls}`}>
      {icon}
      {echo.last_check === null
        ? t('broker.neverChecked')
        : echo.ok
          ? `${echo.rtt_ms ?? '?'} ms`
          : (echo.error ?? t('broker.echoFailed'))}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 sm:h-7 sm:w-7"
        aria-label={t('broker.echoNow')}
        onClick={onEcho}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
      </Button>
    </span>
  );
}

export default function BrokerPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const brokerConfigured = Boolean(getConfig().brokerUrl);

  const statusQuery = useQuery({
    queryKey: ['broker', 'status'],
    queryFn: () => brokerApi.status(),
    enabled: brokerConfigured,
    refetchInterval: 5000,
  });

  const queriesQuery = useQuery({
    queryKey: ['broker', 'queries'],
    queryFn: () => brokerApi.logs.queries(50),
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
  const sourceById = new Map((sourcesQuery.data ?? []).map((s) => [s.id, s]));
  const targetById = new Map((targetsQuery.data ?? []).map((t2) => [t2.id, t2]));

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <RadioTower className="h-6 w-6" />
          {t('broker.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('broker.subtitle')}</p>
      </div>

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
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('broker.recentQueries')}</CardTitle>
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
                      {Object.entries(row.per_source)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(' ')}
                    </TableCell>
                    <TableCell className="text-xs">{row.duration_ms} ms</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'success' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
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
