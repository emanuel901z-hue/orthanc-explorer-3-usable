/**
 * LocalWorklistPage — worklist entries the broker holds itself.
 *
 * Emergencies and unscheduled exams exist in no RIS. They are maintained here
 * (or pushed as HL7 ORM) and merged into every C-FIND with the highest
 * priority. The HL7 panel is the interface check: paste a message, see what the
 * parser understood and what would happen — before wiring up a real RIS.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { brokerApi, type Hl7Parse, type LocalItem, type LocalItemIn } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { useHl7Writes, useLocalItemWrites } from '../hooks/use-broker-local';

const EMPTY: LocalItemIn = {
  accession: '', sps_id: '1', patient_id: '', patient_name: '', birth_date: '', sex: '',
  modality: '', station_aet: '', procedure_description: '', scheduled_date: '',
  scheduled_time: '', study_uid: '', sps_status: 'SCHEDULED', valid_until: null, enabled: true,
};

const SAMPLE_ORM = [
  'MSH|^~\\&|RIS|HOSPITAL|MWLBROKER|RAD|20260917103000||ORM^O01|MSG0001|P|2.5',
  'PID|1||P1001||Mueller^Hans||19800101|M',
  'ORC|NW|PLACER1|FILLER1',
  'OBR|1|PLACER1|ACC-HL7-1|CT^CT Thorax|R|20260917120000',
  'ZDS|1.2.840.113619.2.55.3.1|CT_01',
].join('\r');

export default function LocalWorklistPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [editing, setEditing] = useState<LocalItemIn | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<LocalItem | null>(null);
  const [orm, setOrm] = useState(SAMPLE_ORM);
  const [parse, setParse] = useState<Hl7Parse | null>(null);
  const [error, setError] = useState('');

  const itemsQuery = useQuery({
    queryKey: ['broker', 'local-items'],
    queryFn: brokerApi.localItems.list,
    enabled: configured,
  });
  const messagesQuery = useQuery({
    queryKey: ['broker', 'hl7', 'messages'],
    queryFn: () => brokerApi.hl7.messages(10),
    enabled: configured,
    refetchInterval: 15000,
  });
  const { create, update, remove } = useLocalItemWrites();
  const { apply } = useHl7Writes();

  const items = itemsQuery.data ?? [];

  const save = () => {
    if (!editing) return;
    setError('');
    const done = { onSuccess: () => { setEditing(null); setEditId(null); } };
    if (editId === null) create.mutate(editing, done);
    else update.mutate({ id: editId, body: editing }, done);
  };

  const runHl7 = (dryRun: boolean) => {
    setError('');
    setParse(null);
    apply.mutate({ message: orm, dryRun }, { onSuccess: (result) => setParse(result) });
  };

  const actions = (item: LocalItem) => (
    <>
      <Button
        variant="ghost" size="sm" className="h-9 w-9 p-0"
        aria-label={t('broker.edit')}
        onClick={() => { setEditing({ ...EMPTY, ...item }); setEditId(item.id); }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
        aria-label={t('broker.delete')}
        onClick={() => setRemoving(item)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <BrokerPageShell
      titleKey="broker.localTitle"
      subtitleKey="broker.localSubtitle"
      actions={
        <Button
          size="sm"
          onClick={() => { setEditing({ ...EMPTY }); setEditId(null); }}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('broker.localAdd')}
        </Button>
      }
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('broker.localHintTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t('broker.localHint')}</p>
        </CardContent>
      </Card>

      {isMobile ? (
        <div className="space-y-2">
          {items.map((item) => (
            <ConfigRowCard
              key={item.id}
              title={item.accession}
              badges={
                <>
                  <Badge variant="outline" className="text-[10px]">{item.origin}</Badge>
                  {item.enabled
                    ? <Badge variant="secondary" className="text-[10px]">{t('broker.localEnabled')}</Badge>
                    : <Badge variant="outline" className="text-[10px]">{t('broker.localDisabled')}</Badge>}
                </>
              }
              fields={[
                { label: t('broker.localPatient'), value: item.patient_name || item.patient_id || '—' },
                { label: t('broker.localModality'), value: item.modality || '—' },
                { label: t('broker.localStation'), value: item.station_aet || t('broker.localAnyStation') },
                { label: t('broker.localWhen'), value: `${item.scheduled_date || '—'} ${item.scheduled_time || ''}`.trim() },
                { label: t('broker.localValidUntil'), value: item.valid_until ? item.valid_until.slice(0, 10) : t('broker.localUnlimited') },
              ]}
              actions={actions(item)}
            />
          ))}
          {items.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              {t('broker.localNone')}
            </CardContent></Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.localObject')}</TableHead>
                  <TableHead>{t('broker.localPatient')}</TableHead>
                  <TableHead>{t('broker.localModality')}</TableHead>
                  <TableHead>{t('broker.localStation')}</TableHead>
                  <TableHead>{t('broker.localWhen')}</TableHead>
                  <TableHead>{t('broker.localValidUntil')}</TableHead>
                  <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">
                      <span className="font-medium">{item.accession}</span>
                      <span className="ml-2 inline-flex gap-1">
                        <Badge variant="outline" className="text-[10px]">{item.origin}</Badge>
                        {!item.enabled && (
                          <Badge variant="outline" className="text-[10px]">
                            {t('broker.localDisabled')}
                          </Badge>
                        )}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {item.procedure_description || '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.patient_name || '—'}
                      <p className="text-[10px] text-muted-foreground">{item.patient_id}</p>
                    </TableCell>
                    <TableCell className="text-xs">{item.modality || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {item.station_aet || t('broker.localAnyStation')}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.scheduled_date || '—'} {item.scheduled_time}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.valid_until ? item.valid_until.slice(0, 10) : t('broker.localUnlimited')}
                    </TableCell>
                    <TableCell className="text-right">{actions(item)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {t('broker.localNone')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* HL7 ORM interface check */}
      <Card data-testid="broker-hl7">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('broker.hl7Title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('broker.hl7Hint')}</p>
          <Textarea
            aria-label={t('broker.hl7Message')}
            className="min-h-[140px] font-mono text-xs"
            value={orm}
            onChange={(event) => setOrm(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={apply.isPending} onClick={() => runHl7(true)}>
              {t('broker.hl7Check')}
            </Button>
            <Button size="sm" disabled={apply.isPending} onClick={() => runHl7(false)}>
              {t('broker.hl7Apply')}
            </Button>
          </div>
          {parse && (
            <div className="rounded-md border p-3 text-xs" data-testid="broker-hl7-result">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={parse.action === 'cancelled' ? 'destructive' : 'secondary'}>
                  {parse.dry_run ? t('broker.hl7DryRun') : t('broker.hl7Applied')}
                </Badge>
                <span className="font-mono">{parse.message_type}</span>
                <span className="font-mono">ORC={parse.order_control}</span>
                <span className="font-mono">ACC={parse.accession}</span>
                <span>{t('broker.hl7Action', { action: parse.action })}</span>
              </div>
              <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                {Object.entries(parse.parsed)
                  .filter(([key]) => key !== 'warnings')
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="truncate font-mono">{String(value ?? '')}</dd>
                    </div>
                  ))}
              </dl>
              {parse.warnings.length > 0 && (
                <p className="mt-2 text-amber-600">
                  {t('broker.hl7Warnings')}: {parse.warnings.join('; ')}
                </p>
              )}
            </div>
          )}
          {(error || apply.isError) && (
            <p role="alert" className="text-sm text-destructive">
              {error || (apply.error as Error)?.message}
            </p>
          )}

          <div>
            <p className="text-xs font-medium">{t('broker.hl7Recent')}</p>
            <ul className="mt-1 space-y-1" data-testid="broker-hl7-messages">
              {(messagesQuery.data ?? []).map((message) => (
                <li key={message.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {message.ts.slice(11, 19)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{message.transport}</Badge>
                  <span className="font-mono">{message.order_control || '—'}</span>
                  <span className="font-mono">{message.accession || '—'}</span>
                  <Badge variant={message.action === 'rejected' || message.action === 'error'
                    ? 'destructive' : 'secondary'} className="text-[10px]">
                    {message.action}
                  </Badge>
                  {message.error && <span className="text-destructive">{message.error}</span>}
                </li>
              ))}
              {(messagesQuery.data ?? []).length === 0 && (
                <li className="text-xs text-muted-foreground">{t('broker.hl7NoMessages')}</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* create/edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) { setEditing(null); setEditId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId === null ? t('broker.localAdd') : t('broker.localEdit')}
            </DialogTitle>
            <DialogDescription>{t('broker.localDialogHint')}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['accession', t('broker.localAccession')],
                ['sps_id', t('broker.localSpsId')],
                ['patient_id', t('broker.localPatientId')],
                ['patient_name', t('broker.localPatientName')],
                ['birth_date', t('broker.localBirthDate')],
                ['sex', t('broker.localSex')],
                ['modality', t('broker.localModality')],
                ['station_aet', t('broker.localStation')],
                ['scheduled_date', t('broker.localDate')],
                ['scheduled_time', t('broker.localTime')],
                ['procedure_description', t('broker.localProcedure')],
                ['study_uid', t('broker.localStudyUid')],
              ] as [keyof LocalItemIn, string][]).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`local-${key}`}>{label}</Label>
                  <Input
                    id={`local-${key}`}
                    className="font-mono text-xs"
                    value={String(editing[key] ?? '')}
                    onChange={(event) => setEditing({ ...editing, [key]: event.target.value })}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <div>
                  <Label htmlFor="local-enabled">{t('broker.localEnabled')}</Label>
                  <p className="text-xs text-muted-foreground">{t('broker.localEnabledHint')}</p>
                </div>
                <Switch
                  id="local-enabled"
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
            <Button
              disabled={!editing?.accession || create.isPending || update.isPending}
              onClick={save}
            >
              {t('broker.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        itemName={removing?.accession ?? ''}
        warning={t('broker.localDeleteWarning')}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(removing!.id, { onSuccess: () => setRemoving(null) })}
      />
    </BrokerPageShell>
  );
}
