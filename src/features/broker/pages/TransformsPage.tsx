/**
 * TransformsPage — DICOM attribute modifications applied before forwarding.
 *
 * Rules are scoped to a source and/or target (null = any) and applied in
 * priority order. Keyword validation happens broker-side against the DICOM
 * data dictionary; invalid rules are rejected with a 422 detail list.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { brokerApi, type BrokerTransform, type TransformOperation } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { DiscardConfirm, useDiscardGuard } from '../components/DiscardConfirm';
import { clearDraft, loadDraft, useDraftPersistence, useUnsavedWarning } from '../hooks/use-form-draft';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { OperationsEditor } from '../components/OperationsEditor';
import { useBrokerTransformWrites } from '../hooks/use-broker-writes';

type TransformForm = {
  name: string;
  enabled: boolean;
  priority: number;
  source_id: number | null;
  target_id: number | null;
  operations: TransformOperation[];
};

const ANY = '__any__';
const EMPTY_OPERATION: TransformOperation = { op: 'set', tag: '', value: '' };

const EMPTY_FORM: TransformForm = {
  name: '',
  enabled: true,
  priority: 100,
  source_id: null,
  target_id: null,
  operations: [{ ...EMPTY_OPERATION }],
};

export default function TransformsPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerTransform | null>(null);
  const [deleting, setDeleting] = useState<BrokerTransform | null>(null);
  const [form, setForm] = useState<TransformForm>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const transformsQuery = useQuery({
    queryKey: ['broker', 'transforms'],
    queryFn: brokerApi.transforms.list,
    enabled: configured,
  });
  const sourcesQuery = useQuery({
    queryKey: ['broker', 'sources'],
    queryFn: brokerApi.sources.list,
    enabled: configured,
  });
  const targetsQuery = useQuery({
    queryKey: ['broker', 'targets'],
    queryFn: brokerApi.targets.list,
    enabled: configured,
  });
  const { create, update, remove } = useBrokerTransformWrites();

  const sources = sourcesQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const transforms = transformsQuery.data ?? [];
  const sourceName = (id: number | null) =>
    id === null ? t('broker.anySource') : sources.find((s) => s.id === id)?.name ?? `#${id}`;
  const targetName = (id: number | null) =>
    id === null ? t('broker.anyTarget') : targets.find((tg) => tg.id === id)?.name ?? `#${id}`;
  const pending = create.isPending || update.isPending || remove.isPending;

  useEffect(() => {
    if (!dialogOpen) return;
    setSubmitted(false);
    setForm(editing
      ? {
          name: editing.name,
          enabled: editing.enabled,
          priority: editing.priority,
          source_id: editing.source_id,
          target_id: editing.target_id,
          operations: editing.operations.length ? editing.operations : [{ ...EMPTY_OPERATION }],
        }
      : EMPTY_FORM);
  }, [dialogOpen, editing]);

  const formValid =
    form.name.trim().length > 0 &&
    form.operations.length > 0 &&
    form.operations.every((op) => op.tag.trim().length > 0);

  const dirty = dialogOpen && form.name !== '' && form.name !== (editing?.name ?? '');
  const guard = useDiscardGuard(dirty, () => { setDialogOpen(false); setEditing(null); });
  useUnsavedWarning(dirty);
  const dropDraft = useDraftPersistence(`transform-${editing?.id ?? 'new'}`, form, dirty);

  /** A click anywhere on a row opens the edit dialog (same as the pencil). */
  const openRow = (rule: BrokerTransform) => {
    const draft = loadDraft<TransformForm>(`transform-${rule.id}`);
    setForm(draft ?? {
      name: rule.name, enabled: rule.enabled, priority: rule.priority,
      source_id: rule.source_id, target_id: rule.target_id,
      operations: rule.operations.length ? rule.operations : [{ ...EMPTY_OPERATION }],
    });
    setEditing(rule);
    setDialogOpen(true);
  };

  const submit = () => {
    setSubmitted(true);
    if (!formValid) return;
    const body = {
      name: form.name.trim(),
      enabled: form.enabled,
      priority: form.priority,
      source_id: form.source_id,
      target_id: form.target_id,
      operations: form.operations.map((op) => ({
        op: op.op,
        tag: op.tag.trim(),
        ...(op.value !== undefined && op.value !== '' ? { value: op.value } : {}),
        ...(op.pattern !== undefined && op.pattern !== '' ? { pattern: op.pattern } : {}),
        ...(op.from_tag !== undefined && op.from_tag !== '' ? { from_tag: op.from_tag } : {}),
      })),
    };
    const onDone = () => { dropDraft(); setDialogOpen(false); setEditing(null); };
    if (editing) {
      update.mutate({ id: editing.id, body }, { onSuccess: onDone });
    } else {
      create.mutate(body, { onSuccess: onDone });
    }
  };

  return (
    <BrokerPageShell
      helpId="transforms"
      titleKey="broker.transformsTitle"
      subtitleKey="broker.transformsSubtitle"
      actions={
        <Button
          onClick={() => {
            const draft = loadDraft<TransformForm>('transform-new');
            setForm(draft ?? EMPTY_FORM);
            setEditing(null);
            setDialogOpen(true);
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('broker.addTransform')}
        </Button>
      }
    >
      {isMobile ? (
        <div className="space-y-2">
          {transforms.map((rule) => (
            <ConfigRowCard
              key={rule.id}
              onOpen={() => openRow(rule)}
              title={rule.name}
              fields={[
                {
                  label: t('broker.transformScope'),
                  value: `${sourceName(rule.source_id)} → ${targetName(rule.target_id)}`,
                },
                { label: t('broker.priority'), value: String(rule.priority) },
                {
                  label: t('broker.operations'),
                  value: rule.operations.map((op) => `${op.op} ${op.tag}`).join(', '),
                },
              ]}
              actions={
                <>
                  <Switch
                    checked={rule.enabled}
                    aria-label={t('broker.toggleTransform', { name: rule.name })}
                    onCheckedChange={(checked) =>
                      update.mutate({
                        id: rule.id,
                        body: {
                          name: rule.name, priority: rule.priority,
                          source_id: rule.source_id, target_id: rule.target_id,
                          operations: rule.operations, enabled: checked,
                        },
                      })
                    }
                  />
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0"
                    aria-label={t('broker.editTransform')}
                    onClick={() => {
                      const draft = loadDraft<TransformForm>(`transform-${rule.id}`);
                      setForm(draft ?? {
                        name: rule.name, enabled: rule.enabled, priority: rule.priority,
                        source_id: rule.source_id, target_id: rule.target_id,
                        operations: rule.operations.length ? rule.operations : [{ ...EMPTY_OPERATION }],
                      });
                      setEditing(rule);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
                    aria-label={t('broker.deleteTransform')}
                    onClick={() => setDeleting(rule)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ))}
          {transforms.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t('broker.noTransforms')}
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
                <TableHead>{t('broker.transformScope')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('broker.operations')}</TableHead>
                <TableHead className="hidden md:table-cell w-[110px]">{t('broker.priority')}</TableHead>
                <TableHead className="w-[110px]">{t('broker.enabled')}</TableHead>
                <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transforms.map((rule) => (
                <TableRow
                    key={rule.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={(event) => {
                      // a click on a button/switch inside the row must keep working
                      if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                      openRow(rule);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openRow(rule);
                      }
                    }}
                  >
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-xs">
                    <span className="font-mono">{sourceName(rule.source_id)}</span>
                    {' → '}
                    <span className="font-mono">{targetName(rule.target_id)}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {rule.operations.map((op, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">
                          {op.op} {op.tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{rule.priority}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      aria-label={t('broker.toggleTransform', { name: rule.name })}
                      onCheckedChange={(checked) =>
                        update.mutate({
                          id: rule.id,
                          body: {
                            name: rule.name,
                            priority: rule.priority,
                            source_id: rule.source_id,
                            target_id: rule.target_id,
                            operations: rule.operations,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      aria-label={t('broker.editTransform')}
                      onClick={() => {
                      const draft = loadDraft<TransformForm>(`transform-${rule.id}`);
                      setForm(draft ?? {
                        name: rule.name, enabled: rule.enabled, priority: rule.priority,
                        source_id: rule.source_id, target_id: rule.target_id,
                        operations: rule.operations.length ? rule.operations : [{ ...EMPTY_OPERATION }],
                      });
                      setEditing(rule);
                      setDialogOpen(true);
                    }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      aria-label={t('broker.deleteTransform')}
                      onClick={() => setDeleting(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {transforms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                    {t('broker.noTransforms')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={guard.requestClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('broker.editTransform') : t('broker.addTransform')}
            </DialogTitle>
            <DialogDescription>{t('broker.transformFormHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="transform-name">{t('broker.name')}</Label>
                <Input
                  id="transform-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="kh-accession-prefix"
                />
                {submitted && form.name.trim().length === 0 && (
                  <p className="text-xs text-destructive">{t('broker.errRequired')}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="transform-priority">{t('broker.priority')}</Label>
                <Input
                  id="transform-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">{t('broker.transformPriorityHint')}</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="transform-source">{t('broker.ruleSource')}</Label>
                <Select
                  value={form.source_id === null ? ANY : String(form.source_id)}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, source_id: v === ANY ? null : Number(v) }))
                  }
                >
                  <SelectTrigger id="transform-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>{t('broker.anySource')}</SelectItem>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="transform-target">{t('broker.ruleTarget')}</Label>
                <Select
                  value={form.target_id === null ? ANY : String(form.target_id)}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, target_id: v === ANY ? null : Number(v) }))
                  }
                >
                  <SelectTrigger id="transform-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>{t('broker.anyTarget')}</SelectItem>
                    {targets.map((tg) => (
                      <SelectItem key={tg.id} value={String(tg.id)}>
                        {tg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="transform-enabled" className="cursor-pointer">
                {t('broker.enabled')}
              </Label>
              <Switch
                id="transform-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('broker.operations')}</Label>
              <OperationsEditor
                operations={form.operations}
                onChange={(operations) => setForm((f) => ({ ...f, operations }))}
              />
              {submitted && !formValid && form.operations.length > 0 && (
                <p className="text-xs text-destructive">{t('broker.errOperationTag')}</p>
              )}
            </div>
          </div>

          {(create.error ?? update.error) && (
            <p role="alert" className="text-sm text-destructive break-words">
              {(create.error ?? update.error)?.message}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        itemName={deleting?.name ?? ''}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </BrokerPageShell>
  );
}
