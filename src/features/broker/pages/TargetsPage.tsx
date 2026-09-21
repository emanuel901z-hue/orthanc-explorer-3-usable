/**
 * TargetsPage — CRUD for PACS store targets (C-STORE destinations).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { brokerApi, type BrokerTarget, type EchoStatus } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { EchoBadge } from '../components/EchoBadge';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { NodeFormDialog, type NodeFormValues } from '../components/NodeFormDialog';
import { useBrokerTargetWrites } from '../hooks/use-broker-writes';
import { useBrokerEcho } from '../hooks/use-broker-echo';

export default function TargetsPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerTarget | null>(null);
  const [deleting, setDeleting] = useState<BrokerTarget | null>(null);

  const targetsQuery = useQuery({
    queryKey: ['broker', 'targets'],
    queryFn: brokerApi.targets.list,
    enabled: configured,
  });
  const statusQuery = useQuery({
    queryKey: ['broker', 'status'],
    queryFn: brokerApi.status,
    enabled: configured,
    refetchInterval: 5000,
  });
  const { create, update, remove } = useBrokerTargetWrites();
  const echo = useBrokerEcho();

  const echoById = new Map((statusQuery.data?.targets ?? []).map((e) => [e.id, e]));
  const echoFor = (row: BrokerTarget): EchoStatus =>
    echoById.get(row.id) ?? {
      kind: 'target', id: row.id, name: row.name,
      ok: false, rtt_ms: null, last_check: null, error: null,
    };

  const targets = targetsQuery.data ?? [];
  const pending = create.isPending || update.isPending || remove.isPending;

  /** A click anywhere on a row opens the edit dialog (same as the pencil). */
  const openRow = (row: BrokerTarget) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const submit = (values: NodeFormValues) => {
    const body = { ...values, is_default: Boolean(values.is_default) };
    const onDone = () => { setDialogOpen(false); setEditing(null); };
    if (editing) {
      update.mutate({ id: editing.id, body }, { onSuccess: onDone });
    } else {
      create.mutate(body, { onSuccess: onDone });
    }
  };

  return (
    <BrokerPageShell
      helpId="targets"
      titleKey="broker.targetsTitle"
      subtitleKey="broker.targetsSubtitle"
      actions={
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('broker.addTarget')}
        </Button>
      }
    >
      {isMobile ? (
        <div className="space-y-2">
          {targets.map((row) => (
            <ConfigRowCard
              key={row.id}
              onOpen={() => openRow(row)}
              title={row.name}
              badges={
                <>
                  {row.is_default && (
                    <Badge variant="secondary" className="text-xs">{t('broker.defaultTarget')}</Badge>
                  )}
                  {!row.enabled && (
                    <Badge variant="outline" className="text-xs">{t('broker.disabled')}</Badge>
                  )}
                </>
              }
              fields={[
                { label: t('broker.endpoint'), value: `${row.aet}@${row.host}:${row.port}` },
                { label: t('broker.callingAet'), value: row.calling_aet },
              ]}
              actions={
                <>
                  <EchoBadge
                    echo={echoFor(row)}
                    pending={echo.isPending}
                    onEcho={() => echo.mutate({ kind: 'target', id: row.id })}
                  />
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0"
                    aria-label={t('broker.editTarget')}
                    onClick={() => { setEditing(row); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
                    aria-label={t('broker.deleteTarget')}
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ))}
          {targets.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t('broker.noTargets')}
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
                <TableHead className="hidden md:table-cell">{t('broker.callingAet')}</TableHead>
                <TableHead className="w-[140px]">{t('broker.echo')}</TableHead>
                <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((row) => (
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
                    {row.is_default && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {t('broker.defaultTarget')}
                      </Badge>
                    )}
                    {!row.enabled && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {t('broker.disabled')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">
                    {row.aet}@{row.host}:{row.port}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {row.calling_aet}
                  </TableCell>
                  <TableCell>
                    <EchoBadge
                      echo={echoFor(row)}
                      pending={echo.isPending}
                      onEcho={() => echo.mutate({ kind: 'target', id: row.id })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      aria-label={t('broker.editTarget')}
                      onClick={() => { setEditing(row); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      aria-label={t('broker.deleteTarget')}
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {targets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                    {t('broker.noTargets')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <NodeFormDialog
        kind="target"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        siblings={targets}
        pending={pending}
        error={create.error?.message ?? update.error?.message ?? null}
        onSubmit={submit}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        itemName={deleting?.name ?? ''}
        warning={
          deleting?.is_default
            ? `${t('broker.confirmDeleteDependenciesTarget')} ${t('broker.targetDefaultWarning')}`
            : t('broker.confirmDeleteDependenciesTarget')
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </BrokerPageShell>
  );
}
