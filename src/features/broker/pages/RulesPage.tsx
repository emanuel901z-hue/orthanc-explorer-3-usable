/**
 * RulesPage — routing rules (worklist source → PACS target).
 *
 * The first enabled rule by priority wins; without a matching rule the store
 * falls back to the default target.
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
import { brokerApi, type BrokerRule } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { DiscardConfirm, useDiscardGuard } from '../components/DiscardConfirm';
import { clearDraft, loadDraft, useDraftPersistence, useUnsavedWarning } from '../hooks/use-form-draft';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { useBrokerRuleWrites } from '../hooks/use-broker-writes';

type RuleForm = { source_id: number | null; target_id: number | null; priority: number; enabled: boolean };

const EMPTY_FORM: RuleForm = { source_id: null, target_id: null, priority: 100, enabled: true };

export default function RulesPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerRule | null>(null);
  const [deleting, setDeleting] = useState<BrokerRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ['broker', 'rules'],
    queryFn: brokerApi.rules.list,
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
  const { create, update, remove } = useBrokerRuleWrites();

  const sources = sourcesQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const sourceName = (id: number) => sources.find((s) => s.id === id)?.name ?? `#${id}`;
  const targetName = (id: number) => targets.find((tg) => tg.id === id)?.name ?? `#${id}`;
  const pending = create.isPending || update.isPending || remove.isPending;

  useEffect(() => {
    if (!dialogOpen) return;
    setSubmitted(false);
    setForm(editing
      ? { source_id: editing.source_id, target_id: editing.target_id,
          priority: editing.priority, enabled: editing.enabled }
      : EMPTY_FORM);
  }, [dialogOpen, editing]);

  const formValid = form.source_id !== null && form.target_id !== null;

  const dirty = dialogOpen && JSON.stringify(form) !== JSON.stringify(editing
    ? { source_id: editing.source_id, target_id: editing.target_id, priority: editing.priority, enabled: editing.enabled }
    : EMPTY_FORM);
  const guard = useDiscardGuard(dirty, () => { setDialogOpen(false); setEditing(null); });
  useUnsavedWarning(dirty);

  // the same source+target twice would be ambiguous
  const duplicate = rules.find((rule) => rule.source_id === form.source_id
    && rule.target_id === form.target_id && rule.id !== editing?.id);

  const submit = () => {
    setSubmitted(true);
    if (!formValid) return;
    const body = {
      source_id: form.source_id as number,
      target_id: form.target_id as number,
      priority: form.priority,
      enabled: form.enabled,
    };
    const onDone = () => { setDialogOpen(false); setEditing(null); };
    if (editing) {
      update.mutate({ id: editing.id, body }, { onSuccess: onDone });
    } else {
      create.mutate(body, { onSuccess: onDone });
    }
  };

  return (
    <BrokerPageShell
      titleKey="broker.rulesTitle"
      subtitleKey="broker.rulesSubtitle"
      actions={
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          size="sm"
          disabled={sources.length === 0 || targets.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('broker.addRule')}
        </Button>
      }
    >
      {isMobile ? (
        <div className="space-y-2">
          {rules.map((rule) => (
            <ConfigRowCard
              key={rule.id}
              title={`${sourceName(rule.source_id)} → ${targetName(rule.target_id)}`}
              badges={targets.find((tg) => tg.id === rule.target_id)?.is_default ? (
                <Badge variant="secondary" className="text-xs">{t('broker.defaultTarget')}</Badge>
              ) : null}
              fields={[{ label: t('broker.priority'), value: String(rule.priority) }]}
              actions={
                <>
                  <Switch
                    checked={rule.enabled}
                    aria-label={t('broker.toggleRule', { name: sourceName(rule.source_id) })}
                    onCheckedChange={(checked) =>
                      update.mutate({
                        id: rule.id,
                        body: {
                          source_id: rule.source_id, target_id: rule.target_id,
                          priority: rule.priority, enabled: checked,
                        },
                      })
                    }
                  />
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0"
                    aria-label={t('broker.editRule')}
                    onClick={() => { setEditing(rule); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
                    aria-label={t('broker.deleteRule')}
                    onClick={() => setDeleting(rule)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ))}
          {rules.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t('broker.noRules')}
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
                <TableHead>{t('broker.ruleSource')}</TableHead>
                <TableHead>{t('broker.ruleTarget')}</TableHead>
                <TableHead className="hidden md:table-cell w-[110px]">{t('broker.priority')}</TableHead>
                <TableHead className="w-[110px]">{t('broker.enabled')}</TableHead>
                <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{sourceName(rule.source_id)}</TableCell>
                  <TableCell>
                    {targetName(rule.target_id)}
                    {targets.find((tg) => tg.id === rule.target_id)?.is_default && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {t('broker.defaultTarget')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{rule.priority}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      aria-label={t('broker.toggleRule', { name: sourceName(rule.source_id) })}
                      onCheckedChange={(checked) =>
                        update.mutate({
                          id: rule.id,
                          body: {
                            source_id: rule.source_id,
                            target_id: rule.target_id,
                            priority: rule.priority,
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
                      aria-label={t('broker.editRule')}
                      onClick={() => { setEditing(rule); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      aria-label={t('broker.deleteRule')}
                      onClick={() => setDeleting(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                    {t('broker.noRules')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={guard.requestClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('broker.editRule') : t('broker.addRule')}
            </DialogTitle>
            <DialogDescription>{t('broker.ruleFormHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rule-source">{t('broker.ruleSource')}</Label>
              <Select
                value={form.source_id === null ? '' : String(form.source_id)}
                onValueChange={(v) => setForm((f) => ({ ...f, source_id: Number(v) }))}
              >
                <SelectTrigger id="rule-source">
                  <SelectValue placeholder={t('broker.selectSource')} />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.aet}@{s.host}:{s.port})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {submitted && form.source_id === null && (
                <p role="alert" className="text-xs text-destructive">{t('broker.errRequired')}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="rule-target">{t('broker.ruleTarget')}</Label>
              <Select
                value={form.target_id === null ? '' : String(form.target_id)}
                onValueChange={(v) => setForm((f) => ({ ...f, target_id: Number(v) }))}
              >
                <SelectTrigger id="rule-target">
                  <SelectValue placeholder={t('broker.selectTarget')} />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((tg) => (
                    <SelectItem key={tg.id} value={String(tg.id)}>
                      {tg.name} ({tg.aet}@{tg.host}:{tg.port})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {submitted && form.target_id === null && (
                <p role="alert" className="text-xs text-destructive">{t('broker.errRequired')}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="rule-priority">{t('broker.priority')}</Label>
              <Input
                id="rule-priority"
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">{t('broker.rulePriorityHint')}</p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="rule-enabled" className="cursor-pointer">
                {t('broker.enabled')}
              </Label>
              <Switch
                id="rule-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
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
            {duplicate && (
              <p role="alert" className="text-xs text-amber-600">
                {t('broker.duplicateRule')}
              </p>
            )}

            <Button onClick={submit} disabled={pending || Boolean(duplicate)}>
              {pending ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        itemName={deleting ? `${sourceName(deleting.source_id)} → ${targetName(deleting.target_id)}` : ''}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </BrokerPageShell>
  );
}
