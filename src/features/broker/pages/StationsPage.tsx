/**
 * StationsPage — per-station worklist rules.
 *
 * A console should see its own worklist: a rule restricts which sources are
 * visible for a station and can reorder them for the merge (so the emergency
 * RIS wins the dedupe for the CT). The preview answers the question the
 * operator actually has — "what would this console see?" — using the same rule
 * matching as the live C-FIND.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { brokerApi, type StationRule, type StationRuleIn } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { DiscardConfirm, useDiscardGuard } from '../components/DiscardConfirm';
import { clearDraft, loadDraft, useDraftPersistence, useUnsavedWarning } from '../hooks/use-form-draft';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { useStationRuleWrites } from '../hooks/use-broker-stations';

const EMPTY: StationRuleIn = {
  name: '', station_aet: '*', mode: 'deny', source_ids: [], source_priority: {},
  priority: 100, enabled: true,
};

export default function StationsPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [editing, setEditing] = useState<StationRuleIn | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<StationRule | null>(null);
  const [previewFor, setPreviewFor] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof brokerApi.stationRules.simulate>> | null>(null);

  const rulesQuery = useQuery({
    queryKey: ['broker', 'station-rules'],
    queryFn: brokerApi.stationRules.list,
    enabled: configured,
  });
  const sourcesQuery = useQuery({
    queryKey: ['broker', 'sources'],
    queryFn: brokerApi.sources.list,
    enabled: configured,
  });
  const { create, update, remove } = useStationRuleWrites();

  const rules = rulesQuery.data ?? [];
  const sources = sourcesQuery.data ?? [];
  const sourceName = (id: number) => sources.find((source) => source.id === id)?.name ?? `#${id}`;

  const save = () => {
    if (!editing) return;
    const done = { onSuccess: () => { setEditing(null); setEditId(null); } };
    if (editId === null) create.mutate(editing, done);
    else update.mutate({ id: editId, body: editing }, done);
  };

  const runPreview = async (station: string) => {
    setPreviewFor(station);
    setPreview(await brokerApi.stationRules.simulate(station));
  };

  const toggleSource = (id: number) => {
    if (!editing) return;
    const listed = new Set(editing.source_ids);
    if (listed.has(id)) listed.delete(id);
    else listed.add(id);
    setEditing({ ...editing, source_ids: [...listed].sort((a, b) => a - b) });
  };

  const actions = (rule: StationRule) => (
    <>
      <Button
        variant="ghost" size="sm" className="h-9 w-9 p-0"
        aria-label={t('broker.stationPreview')}
        onClick={() => runPreview(rule.station_aet)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="sm" className="h-9 w-9 p-0"
        aria-label={t('broker.edit')}
        onClick={() => {
          const draft = loadDraft<StationRuleIn>(`station-${rule.id}`);
          setEditing(draft ? { ...EMPTY, ...draft } : { ...rule });
          setEditId(rule.id);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
        aria-label={t('broker.delete')}
        onClick={() => setRemoving(rule)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  const ruleFields = (rule: StationRule) => [
    { label: t('broker.stationAet'), value: rule.station_aet },
    { label: t('broker.stationMode'), value: rule.mode },
    { label: t('broker.stationSources'), value: rule.source_ids.map(sourceName).join(', ') || '—' },
    { label: t('broker.priority'), value: String(rule.priority) },
  ];

  const pristineRule = rules.find((rule) => rule.id === editId);
  const pristine = pristineRule ? { ...EMPTY, ...pristineRule } : EMPTY;
  const dirty = Boolean(editing) && JSON.stringify(editing) !== JSON.stringify(pristine);
  const guard = useDiscardGuard(dirty, () => { setEditing(null); setEditId(null); });
  useDraftPersistence(`station-${editId ?? 'new'}`, editing, dirty);
  useUnsavedWarning(Boolean(editing) && dirty);

  return (
    <BrokerPageShell
      titleKey="broker.stationTitle"
      subtitleKey="broker.stationSubtitle"
      actions={
        <Button size="sm" onClick={() => {
          const draft = loadDraft<StationRuleIn>('station-new');
          setEditing(draft ? { ...EMPTY, ...draft } : { ...EMPTY });
          setEditId(null);
        }}>
          <Plus className="h-4 w-4 mr-1" />
          {t('broker.stationAdd')}
        </Button>
      }
    >
      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">{t('broker.stationHint')}</p>
        </CardContent>
      </Card>

      {isMobile ? (
        <div className="space-y-2">
          {rules.map((rule) => (
            <ConfigRowCard
              key={rule.id}
              title={rule.name}
              badges={
                <>
                  <Badge variant={rule.mode === 'deny' ? 'secondary' : 'outline'} className="text-[10px]">
                    {rule.mode}
                  </Badge>
                  {!rule.enabled && (
                    <Badge variant="outline" className="text-[10px]">{t('broker.disabled')}</Badge>
                  )}
                </>
              }
              fields={ruleFields(rule)}
              actions={actions(rule)}
            />
          ))}
          {rules.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              {t('broker.stationNone')}
            </CardContent></Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.name')}</TableHead>
                  <TableHead>{t('broker.stationAet')}</TableHead>
                  <TableHead className="w-[100px]">{t('broker.stationMode')}</TableHead>
                  <TableHead>{t('broker.stationSources')}</TableHead>
                  <TableHead className="w-[90px]">{t('broker.priority')}</TableHead>
                  <TableHead className="w-[140px] text-right">{t('broker.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="text-xs">
                      <span className="font-medium">{rule.name}</span>
                      {!rule.enabled && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {t('broker.disabled')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rule.station_aet}</TableCell>
                    <TableCell>
                      <Badge variant={rule.mode === 'deny' ? 'secondary' : 'outline'} className="text-xs">
                        {rule.mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {rule.source_ids.map(sourceName).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-xs">{rule.priority}</TableCell>
                    <TableCell className="text-right">{actions(rule)}</TableCell>
                  </TableRow>
                ))}
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {t('broker.stationNone')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* preview */}
      <Card data-testid="broker-station-preview">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('broker.stationPreviewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('broker.stationPreviewHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={t('broker.stationAet')}
              className="max-w-[180px] font-mono"
              placeholder="CT_01"
              value={previewFor}
              onChange={(event) => setPreviewFor(event.target.value.toUpperCase())}
            />
            <Button variant="outline" size="sm" disabled={!previewFor} onClick={() => runPreview(previewFor)}>
              {t('broker.stationPreview')}
            </Button>
          </div>
          {preview && (
            <div className="rounded-md border p-3 text-xs" data-testid="broker-station-preview-result">
              <p>
                {t('broker.stationPreviewRule', {
                  rule: preview.rule_name ?? t('broker.stationPreviewNoRule'),
                })}
              </p>
              <p className="text-muted-foreground">{preview.reason}</p>
              <ul className="mt-2 space-y-1">
                {preview.sources.map((source) => (
                  <li key={source.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{source.name}</span>
                    <Badge variant={source.visible ? 'secondary' : 'destructive'} className="text-[10px]">
                      {source.visible ? t('broker.stationVisible') : t('broker.stationHidden')}
                    </Badge>
                    <span className="text-muted-foreground">
                      {t('broker.priority')}: {source.effective_priority}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={guard.requestClose}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId === null ? t('broker.stationAdd') : t('broker.stationEdit')}</DialogTitle>
            <DialogDescription>{t('broker.stationDialogHint')}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="station-name">{t('broker.name')}</Label>
                  <Input
                    id="station-name"
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="station-aet">{t('broker.stationAet')}</Label>
                  <Input
                    id="station-aet"
                    className="font-mono"
                    placeholder="CT_01"
                    value={editing.station_aet}
                    onChange={(event) => setEditing({ ...editing, station_aet: event.target.value.toUpperCase() })}
                  />
                  <p className="text-xs text-muted-foreground">{t('broker.stationAetHint')}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="station-mode">{t('broker.stationMode')}</Label>
                  <Select
                    value={editing.mode}
                    onValueChange={(value) => setEditing({ ...editing, mode: value as 'allow' | 'deny' })}
                  >
                    <SelectTrigger id="station-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deny">{t('broker.stationModeDeny')}</SelectItem>
                      <SelectItem value="allow">{t('broker.stationModeAllow')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="station-priority">{t('broker.priority')}</Label>
                  <Input
                    id="station-priority"
                    type="number"
                    className="font-mono"
                    value={editing.priority}
                    onChange={(event) => setEditing({ ...editing, priority: Number(event.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">{t('broker.priorityHint')}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('broker.stationSources')}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sources.map((source) => (
                    <label
                      key={source.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        aria-label={`source-${source.name}`}
                        checked={editing.source_ids.includes(source.id)}
                        onChange={() => toggleSource(source.id)}
                      />
                      <span className="font-mono text-xs">{source.name}</span>
                    </label>
                  ))}
                  {sources.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t('broker.stationNoSources')}</p>
                  )}
                </div>
              </div>

              {/* a rule that hides every source makes the console's worklist empty */}
              {editing.mode === 'allow' && editing.source_ids.length === 0 && (
                <p role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700">
                  {t('broker.stationAllowEmptyWarning')}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="station-enabled">{t('broker.enabled')}</Label>
                  <p className="text-xs text-muted-foreground">{t('broker.stationEnabledHint')}</p>
                </div>
                <Switch
                  id="station-enabled"
                  checked={editing.enabled}
                  onCheckedChange={(checked) => setEditing({ ...editing, enabled: checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setEditId(null); }}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button disabled={!editing?.name || create.isPending || update.isPending} onClick={save}>
              {t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        itemName={removing?.name ?? ''}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(removing!.id, { onSuccess: () => setRemoving(null) })}
      />
    </BrokerPageShell>
  );
}
