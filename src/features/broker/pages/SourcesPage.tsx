/**
 * SourcesPage — CRUD for upstream MWL sources (RIS/KIS).
 *
 * Every write is audited (BEFORE + AFTER) via use-broker-writes.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { brokerApi, type BrokerSource, type EchoStatus } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { EchoBadge } from '../components/EchoBadge';
import { BreakerBadge } from '../components/BreakerBadge';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { NodeFormDialog, type NodeFormValues } from '../components/NodeFormDialog';
import { useBrokerSourceWrites } from '../hooks/use-broker-writes';
import { useBrokerEcho } from '../hooks/use-broker-echo';

export default function SourcesPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerSource | null>(null);
  const [deleting, setDeleting] = useState<BrokerSource | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ['broker', 'sources'],
    queryFn: brokerApi.sources.list,
    enabled: configured,
  });
  const statusQuery = useQuery({
    queryKey: ['broker', 'status'],
    queryFn: brokerApi.status,
    enabled: configured,
    refetchInterval: 5000,
  });
  const { create, update, remove, resetBreaker } = useBrokerSourceWrites();
  const echo = useBrokerEcho();

  const echoById = new Map((statusQuery.data?.sources ?? []).map((e) => [e.id, e]));
  const echoFor = (row: BrokerSource): EchoStatus =>
    echoById.get(row.id) ?? {
      kind: 'source', id: row.id, name: row.name,
      ok: false, rtt_ms: null, last_check: null, error: null,
    };

  const sources = sourcesQuery.data ?? [];
  const pending = create.isPending || update.isPending || remove.isPending;

  // "does this RIS deliver worklists?" — a real C-FIND, not just a C-ECHO
  const [queryTarget, setQueryTarget] = useState<BrokerSource | null>(null);
  const queryTest = useMutation({
    mutationFn: (row: BrokerSource) => brokerApi.sources.query(row.id),
  });
  const closeQueryTest = () => { setQueryTarget(null); queryTest.reset(); };

  /** A click anywhere on a row opens the edit dialog (same as the pencil). */
  const openRow = (row: BrokerSource) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const submit = (values: NodeFormValues) => {
    const onDone = () => { setDialogOpen(false); setEditing(null); };
    if (editing) {
      update.mutate({ id: editing.id, body: values }, { onSuccess: onDone });
    } else {
      create.mutate(values, { onSuccess: onDone });
    }
  };

  return (
    <BrokerPageShell
      helpId="sources"
      titleKey="broker.sourcesTitle"
      subtitleKey="broker.sourcesSubtitle"
      actions={
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('broker.addSource')}
        </Button>
      }
    >
      {isMobile ? (
        <div className="space-y-2">
          {sources.map((row) => (
            <ConfigRowCard
              key={row.id}
              onOpen={() => openRow(row)}
              title={row.name}
              badges={
                <>
                  {!row.enabled && (
                    <Badge variant="outline" className="text-xs">{t('broker.disabled')}</Badge>
                  )}
                  <BreakerBadge
                    state={echoFor(row).breaker_state}
                    retryInS={echoFor(row).breaker_retry_in_s}
                    pending={resetBreaker.isPending}
                    onReset={() => resetBreaker.mutate(row.id)}
                  />
                </>
              }
              fields={[
                { label: t('broker.endpoint'), value: `${row.aet}@${row.host}:${row.port}` },
                { label: t('broker.charset'), value: row.charset },
                { label: t('broker.timeout'), value: `${row.timeout_s}s` },
                { label: t('broker.priority'), value: String(row.priority) },
              ]}
              actions={
                <>
                  <EchoBadge
                    echo={echoFor(row)}
                    pending={echo.isPending}
                    onEcho={() => echo.mutate({ kind: 'source', id: row.id })}
                  />
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0"
                    aria-label={t('broker.queryTest')}
                    title={t('broker.queryTest')}
                    disabled={queryTest.isPending}
                    onClick={() => { setQueryTarget(row); queryTest.mutate(row); }}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0"
                    aria-label={t('broker.editSource')}
                    onClick={() => { setEditing(row); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
                    aria-label={t('broker.deleteSource')}
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ))}
          {sources.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t('broker.noSources')}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('broker.name')}</TableHead>
                <TableHead>{t('broker.endpoint')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('broker.charset')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('broker.timeout')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('broker.priority')}</TableHead>
                <TableHead className="w-[140px]">{t('broker.echo')}</TableHead>
                <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((row) => (
                <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={(event) => {
                      // a click on a button/switch inside the row must keep working
                      if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                      openRow(row);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openRow(row);
                      }
                    }}
                  >
                  <TableCell className="font-medium">
                    {row.name}
                    {!row.enabled && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {t('broker.disabled')}
                      </Badge>
                    )}
                    <span className="ml-2 inline-block align-middle">
                      <BreakerBadge
                        state={echoFor(row).breaker_state}
                        retryInS={echoFor(row).breaker_retry_in_s}
                        pending={resetBreaker.isPending}
                        onReset={() => resetBreaker.mutate(row.id)}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">
                    {row.aet}@{row.host}:{row.port}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {row.charset}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">
                    {row.timeout_s}s
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">
                    {row.priority}
                  </TableCell>
                  <TableCell>
                    <EchoBadge
                      echo={echoFor(row)}
                      pending={echo.isPending}
                      onEcho={() => echo.mutate({ kind: 'source', id: row.id })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="sm" className="h-9 w-9 p-0"
                      aria-label={t('broker.queryTest')}
                      title={t('broker.queryTest')}
                      disabled={queryTest.isPending}
                      onClick={() => { setQueryTarget(row); queryTest.mutate(row); }}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      aria-label={t('broker.editSource')}
                      onClick={() => { setEditing(row); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      aria-label={t('broker.deleteSource')}
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                    {t('broker.noSources')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <NodeFormDialog
        kind="source"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        siblings={sources}
        pending={pending}
        error={create.error?.message ?? update.error?.message ?? null}
        onSubmit={submit}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        itemName={deleting?.name ?? ''}
        warning={t('broker.confirmDeleteDependenciesSource')}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />

      {/* C-FIND test: the answer to "why does this console see nothing?" */}
      <Dialog open={queryTarget !== null} onOpenChange={(open) => { if (!open) closeQueryTest(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('broker.queryTestTitle', { name: queryTarget?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('broker.queryTestHint')}</DialogDescription>
          </DialogHeader>
          {queryTest.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('broker.previewRunning')}
            </p>
          ) : queryTest.data ? (
            <div className="space-y-3 text-sm" data-testid="query-test-result">
              <p className={queryTest.data.ok ? '' : 'text-destructive'}>
                {queryTest.data.ok
                  ? t('broker.queryTestOk', { count: queryTest.data.answers, ms: queryTest.data.duration_ms })
                  : t('broker.queryTestFailed', { error: queryTest.data.error })}
              </p>
              {queryTest.data.items.length > 0 && (
                <ul className="space-y-1 font-mono text-xs">
                  {queryTest.data.items.map((item, index) => (
                    <li key={index}>
                      {item.accession} · {item.modality} · {item.station_aet} · {item.start_date}
                    </li>
                  ))}
                </ul>
              )}
              {queryTest.data.truncated && (
                <p className="text-xs text-muted-foreground">{t('broker.previewTruncated')}</p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeQueryTest}>{t('broker.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  );
}
