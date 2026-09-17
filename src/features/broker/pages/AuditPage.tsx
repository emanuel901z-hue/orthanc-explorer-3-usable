/**
 * AuditPage — configuration change log with rollback, export and import.
 *
 * Every configuration change is recorded server-side with its before/after
 * snapshot. This page is the operator's safety net: see what changed, undo it,
 * and move a whole configuration between environments (import is dry-run first).
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Download, History, RotateCcw, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { brokerApi, type ConfigAuditEntry, type ConfigDocument, type ImportPlan } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { format } from 'date-fns';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { ConfigDiffTable } from '../components/ConfigDiffTable';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { useBrokerAuditWrites } from '../hooks/use-broker-audit';
import { describeEntry, diffFields } from '../lib/config-diff';

const ENTITIES = ['all', 'source', 'target', 'rule', 'transform', 'setting'] as const;

function downloadJson(doc: ConfigDocument) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mwl-broker-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const fileInput = useRef<HTMLInputElement>(null);

  const [entity, setEntity] = useState<string>('all');
  const [detail, setDetail] = useState<ConfigAuditEntry | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<ConfigAuditEntry | null>(null);
  const [pendingImport, setPendingImport] = useState<{ doc: ConfigDocument; plan: ImportPlan } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const auditQuery = useQuery({
    queryKey: ['broker', 'audit', entity],
    queryFn: () => brokerApi.audit.config(entity === 'all' ? {} : { entity }),
    enabled: configured,
    refetchInterval: 15000,
  });
  const { rollback, importConfig } = useBrokerAuditWrites();

  const entries = auditQuery.data ?? [];

  const handleExport = async () => {
    setExporting(true);
    try {
      downloadJson(await brokerApi.config.export());
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    try {
      const doc = JSON.parse(await file.text()) as ConfigDocument;
      const plan = await brokerApi.config.import(doc, true);
      setPendingImport({ doc, plan });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const rowActions = (entry: ConfigAuditEntry) => (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        aria-label={t('broker.auditDetails')}
        onClick={() => setDetail(entry)}
      >
        <History className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        aria-label={t('broker.auditRollback')}
        onClick={() => setRollbackTarget(entry)}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <BrokerPageShell
      titleKey="broker.auditTitle"
      subtitleKey="broker.auditSubtitle"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-[160px]" aria-label={t('broker.auditFilter')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === 'all' ? t('broker.auditFilterAll') : t(`broker.entity_${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {t('broker.auditExport')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {t('broker.auditImport')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="audit-import-input"
            aria-label={t('broker.auditImport')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
        </div>
      }
    >
      {importError && (
        <Card className="border-destructive/30 bg-destructive/5" data-testid="import-error">
          <CardContent className="p-3 text-sm text-destructive">
            {t('broker.auditImportError')}: {importError}
          </CardContent>
        </Card>
      )}

      {isMobile ? (
        <div className="space-y-2">
          {entries.map((entry) => {
            const { kind, name } = describeEntry(entry);
            return (
              <ConfigRowCard
                key={entry.id}
                title={name}
                badges={
                  <>
                    <Badge variant="outline" className="text-xs">{t(`broker.entity_${entry.entity}`)}</Badge>
                    <Badge variant="secondary" className="text-xs">{t(`broker.auditKind_${kind}`)}</Badge>
                  </>
                }
                fields={[
                  { label: t('broker.auditAction'), value: entry.action },
                  { label: t('broker.auditActor'), value: entry.actor },
                  { label: t('broker.auditTime'), value: format(new Date(entry.ts), 'dd.MM.yyyy HH:mm:ss') },
                ]}
                actions={rowActions(entry)}
              />
            );
          })}
          {entries.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t('broker.auditEmpty')}
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
                  <TableHead>{t('broker.auditTime')}</TableHead>
                  <TableHead>{t('broker.auditActor')}</TableHead>
                  <TableHead>{t('broker.auditAction')}</TableHead>
                  <TableHead>{t('broker.auditObject')}</TableHead>
                  <TableHead className="w-[120px]">{t('broker.auditChanges')}</TableHead>
                  <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const { kind, name } = describeEntry(entry);
                  const changed = diffFields(entry.before_json, entry.after_json).length;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">
                        {format(new Date(entry.ts), 'dd.MM.yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="text-xs">{entry.actor}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                      <TableCell className="text-xs">
                        {name}
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {t(`broker.entity_${entry.entity}`)}
                        </Badge>
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {t(`broker.auditKind_${kind}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {changed > 0 ? t('broker.auditFields', { count: changed }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{rowActions(entry)}</TableCell>
                    </TableRow>
                  );
                })}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {t('broker.auditEmpty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* diff of one change */}
      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('broker.auditDetails')}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.action} · ${detail.actor} · ${format(new Date(detail.ts), 'dd.MM.yyyy HH:mm:ss')}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && <ConfigDiffTable before={detail.before_json} after={detail.after_json} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* import: dry-run first, apply on confirmation */}
      <Dialog open={pendingImport !== null} onOpenChange={(open) => { if (!open) setPendingImport(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('broker.auditImportTitle')}</DialogTitle>
            <DialogDescription>{t('broker.auditImportHint')}</DialogDescription>
          </DialogHeader>

          {pendingImport && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{t('broker.auditImportCreate', { count: pendingImport.plan.summary.create })}</Badge>
                <Badge variant="secondary">{t('broker.auditImportUpdate', { count: pendingImport.plan.summary.update })}</Badge>
                {pendingImport.plan.summary.skipped > 0 && (
                  <Badge variant="destructive">{t('broker.auditImportSkipped', { count: pendingImport.plan.summary.skipped })}</Badge>
                )}
              </div>

              {pendingImport.plan.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('broker.auditImportNoChanges')}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {pendingImport.plan.changes.map((change) => (
                    <li key={`${change.entity}-${change.name}`} className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t(`broker.entity_${change.entity}`)}</Badge>
                      <span className="font-mono text-xs">{change.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`broker.auditKind_${change.action}`)} · {Object.keys(change.fields).length}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {pendingImport.plan.skipped.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <p className="text-xs font-medium text-destructive">{t('broker.auditImportSkippedTitle')}</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-destructive">
                    {pendingImport.plan.skipped.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              disabled={importConfig.isPending || (pendingImport?.plan.changes.length ?? 0) === 0}
              onClick={() => {
                if (!pendingImport) return;
                importConfig.mutate(pendingImport.doc, { onSuccess: () => setPendingImport(null) });
              }}
            >
              {t('broker.auditImportApply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={rollbackTarget !== null}
        onOpenChange={(open) => { if (!open) setRollbackTarget(null); }}
        itemName={rollbackTarget ? `${rollbackTarget.action} #${rollbackTarget.id}` : ''}
        warning={t('broker.auditRollbackWarning')}
        pending={rollback.isPending}
        onConfirm={() => {
          if (!rollbackTarget) return;
          rollback.mutate(rollbackTarget.id, { onSuccess: () => setRollbackTarget(null) });
        }}
      />
    </BrokerPageShell>
  );
}
