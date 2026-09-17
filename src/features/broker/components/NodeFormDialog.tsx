/**
 * Create/edit dialog for a broker DICOM node — used for both upstream MWL
 * sources and PACS store targets (they share the DICOM endpoint fields).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import type { BrokerSource, BrokerTarget, BrokerSourceIn } from '@/api/broker';

export type NodeKind = 'source' | 'target';

export type NodeFormValues = BrokerSourceIn & { is_default?: boolean };

const COMMON_CHARSETS = ['ISO_IR 100', 'ISO_IR 192', 'ISO_IR 6', 'ISO_IR 144', 'ISO_IR 148'];
const AET_RE = /^[A-Z0-9_-]{1,16}$/;

const DEFAULTS: NodeFormValues = {
  name: '',
  aet: '',
  host: '',
  port: 104,
  calling_aet: 'MWLBROKER',
  charset: 'ISO_IR 100',
  enabled: true,
  timeout_s: 10,
  priority: 100,
  cache_stale_on_error: true,
  cache_refresh_s: 0,
  is_default: false,
};

function fromRow(kind: NodeKind, row: BrokerSource | BrokerTarget): NodeFormValues {
  const base = {
    name: row.name,
    aet: row.aet,
    host: row.host,
    port: row.port,
    calling_aet: row.calling_aet,
    enabled: row.enabled,
    charset: 'charset' in row ? row.charset : DEFAULTS.charset,
    timeout_s: 'timeout_s' in row ? row.timeout_s : DEFAULTS.timeout_s,
    priority: 'priority' in row ? row.priority : DEFAULTS.priority,
    cache_stale_on_error: 'cache_stale_on_error' in row ? row.cache_stale_on_error : true,
    cache_refresh_s: 'cache_refresh_s' in row ? row.cache_refresh_s : 0,
    is_default: kind === 'target' && 'is_default' in row ? row.is_default : false,
  };
  return base as NodeFormValues;
}

function validate(values: NodeFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'required';
  if (!AET_RE.test(values.aet)) errors.aet = 'aet';
  if (!values.host.trim()) errors.host = 'host';
  if (!Number.isInteger(values.port) || values.port < 1 || values.port > 65535) errors.port = 'port';
  if (values.calling_aet && !AET_RE.test(values.calling_aet)) errors.calling_aet = 'aet';
  if (values.timeout_s !== undefined && (values.timeout_s < 1 || values.timeout_s > 120)) {
    errors.timeout_s = 'timeout';
  }
  return errors;
}

export function NodeFormDialog({
  kind,
  open,
  onOpenChange,
  initial,
  pending,
  error,
  onSubmit,
}: {
  kind: NodeKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BrokerSource | BrokerTarget | null;
  pending: boolean;
  /** Server-side error (validation/conflict) from the last attempt. */
  error?: string | null;
  onSubmit: (values: NodeFormValues) => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<NodeFormValues>(DEFAULTS);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setValues(initial ? fromRow(kind, initial) : DEFAULTS);
  }, [open, initial, kind]);

  const errors = validate(values);
  const set = <K extends keyof NodeFormValues>(key: K, value: NodeFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const showError = (field: string) => submitted && errors[field];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? t(`broker.${kind}EditTitle`, { defaultValue: t('broker.editTitle') })
              : t(`broker.${kind}AddTitle`, { defaultValue: t('broker.addTitle') })}
          </DialogTitle>
          <DialogDescription>
            {kind === 'source' ? t('broker.sourceFormHint') : t('broker.targetFormHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="node-name">{t('broker.name')}</Label>
            <Input
              id="node-name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="ris-a"
            />
            {showError('name') && <p className="text-xs text-destructive">{t('broker.errRequired')}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="node-aet">{t('broker.aet')}</Label>
            <Input
              id="node-aet"
              value={values.aet}
              onChange={(e) => set('aet', e.target.value.toUpperCase())}
              placeholder="RIS_A"
              className="font-mono"
            />
            {showError('aet') && <p className="text-xs text-destructive">{t('broker.errAet')}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="node-host">{t('broker.host')}</Label>
            <Input
              id="node-host"
              value={values.host}
              onChange={(e) => set('host', e.target.value)}
              placeholder="ris-a.hospital.local"
              className="font-mono"
            />
            {showError('host') && <p className="text-xs text-destructive">{t('broker.errRequired')}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="node-port">{t('broker.port')}</Label>
            <Input
              id="node-port"
              type="number"
              min={1}
              max={65535}
              value={values.port}
              onChange={(e) => set('port', Number(e.target.value))}
            />
            {showError('port') && <p className="text-xs text-destructive">{t('broker.errPort')}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="node-calling-aet">{t('broker.callingAet')}</Label>
            <Input
              id="node-calling-aet"
              value={values.calling_aet}
              onChange={(e) => set('calling_aet', e.target.value.toUpperCase())}
              className="font-mono"
            />
            {showError('calling_aet') && <p className="text-xs text-destructive">{t('broker.errAet')}</p>}
          </div>

          {kind === 'source' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="node-charset">{t('broker.charset')}</Label>
                <Select value={values.charset} onValueChange={(v) => set('charset', v)}>
                  <SelectTrigger id="node-charset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_CHARSETS.map((cs) => (
                      <SelectItem key={cs} value={cs}>
                        {cs}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="node-timeout">{t('broker.timeout')}</Label>
                <Input
                  id="node-timeout"
                  type="number"
                  min={1}
                  max={120}
                  value={values.timeout_s}
                  onChange={(e) => set('timeout_s', Number(e.target.value))}
                />
                {showError('timeout_s') && (
                  <p className="text-xs text-destructive">{t('broker.errTimeout')}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="node-priority">{t('broker.priority')}</Label>
                <Input
                  id="node-priority"
                  type="number"
                  value={values.priority}
                  onChange={(e) => set('priority', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">{t('broker.priorityHint')}</p>
              </div>

              {kind === 'source' && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">{t('broker.cacheGroup')}</p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="node-cache-stale">{t('broker.cacheStaleOnError')}</Label>
                      <p className="text-xs text-muted-foreground">{t('broker.cacheStaleOnErrorHint')}</p>
                    </div>
                    <Switch
                      id="node-cache-stale"
                      checked={values.cache_stale_on_error ?? true}
                      onCheckedChange={(checked) => set('cache_stale_on_error', checked)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="node-cache-refresh">{t('broker.cacheRefresh')}</Label>
                    <Input
                      id="node-cache-refresh"
                      type="number"
                      min={0}
                      max={86400}
                      className="font-mono"
                      value={values.cache_refresh_s ?? 0}
                      onChange={(e) => set('cache_refresh_s', Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">{t('broker.cacheRefreshHint')}</p>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="node-enabled" className="cursor-pointer">
              {t('broker.enabled')}
            </Label>
            <Switch
              id="node-enabled"
              checked={values.enabled}
              onCheckedChange={(v) => set('enabled', v)}
            />
          </div>

          {kind === 'target' && (
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="node-default" className="cursor-pointer">
                  {t('broker.defaultTarget')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('broker.defaultTargetHint')}</p>
              </div>
              <Switch
                id="node-default"
                checked={Boolean(values.is_default)}
                onCheckedChange={(v) => set('is_default', v)}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive break-words">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            onClick={() => {
              setSubmitted(true);
              if (Object.keys(errors).length === 0) onSubmit(values);
            }}
            disabled={pending}
          >
            {pending ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
