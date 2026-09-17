/**
 * SpoolPage — the store-and-forward queue.
 *
 * Every instance that could not be delivered is listed here with its target,
 * attempt count and last error. The operator can retry single entries or — after
 * a PACS outage — all of them at once. Discarding is possible but requires a
 * reason, because it really does lose the instance.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { brokerApi, type SpoolItem } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { format } from 'date-fns';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { ConfigRowCard } from '../components/ConfigRowCard';
import { useBrokerSpoolWrites } from '../hooks/use-broker-spool';

const STATUSES = ['all', 'queued', 'failed', 'dead', 'sent'] as const;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export default function SpoolPage() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [status, setStatus] = useState<string>('all');
  const [discarding, setDiscarding] = useState<SpoolItem | null>(null);
  const [reason, setReason] = useState('');

  const spoolQuery = useQuery({
    queryKey: ['broker', 'spool', 'items', status],
    queryFn: () => brokerApi.spool.items(status === 'all' ? {} : { status }),
    enabled: configured,
    refetchInterval: 10000,
  });
  const { retry, discard } = useBrokerSpoolWrites();

  const entries = spoolQuery.data ?? [];

  const actions = (entry: SpoolItem) => (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        aria-label={t('broker.spoolRetry')}
        disabled={entry.status === 'sent' || retry.isPending}
        onClick={() => retry.mutate(entry.id)}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 text-destructive"
        aria-label={t('broker.spoolDiscard')}
        onClick={() => { setDiscarding(entry); setReason(''); }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  const statusBadge = (entry: SpoolItem) => (
    <Badge
      variant={entry.status === 'dead' ? 'destructive' : entry.status === 'sent' ? 'outline' : 'secondary'}
      className="text-xs"
    >
      {t(`broker.spoolStatus_${entry.status}`)}
    </Badge>
  );

  return (
    <BrokerPageShell
      titleKey="broker.spoolPageTitle"
      subtitleKey="broker.spoolPageSubtitle"
      actions={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]" aria-label={t('broker.spoolFilter')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value === 'all' ? t('broker.spoolFilterAll') : t(`broker.spoolStatus_${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {isMobile ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <ConfigRowCard
              key={entry.id}
              title={entry.accession || entry.sop_instance_uid}
              badges={statusBadge(entry)}
              fields={[
                { label: t('broker.spoolTarget'), value: entry.target_name || '—' },
                { label: t('broker.spoolAttempts'), value: String(entry.attempts) },
                { label: t('broker.spoolSize'), value: formatBytes(entry.payload_bytes) },
                { label: t('broker.spoolAge'), value: `${entry.age_s}s` },
                ...(entry.last_error ? [{ label: t('broker.spoolError'), value: entry.last_error }] : []),
              ]}
              actions={actions(entry)}
            />
          ))}
          {entries.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t('broker.spoolNone')}
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
                  <TableHead>{t('broker.spoolObject')}</TableHead>
                  <TableHead>{t('broker.spoolTarget')}</TableHead>
                  <TableHead className="w-[110px]">{t('broker.spoolStatus')}</TableHead>
                  <TableHead className="w-[90px]">{t('broker.spoolAttempts')}</TableHead>
                  <TableHead className="w-[90px]">{t('broker.spoolSize')}</TableHead>
                  <TableHead>{t('broker.spoolError')}</TableHead>
                  <TableHead className="w-[110px] text-right">{t('broker.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs">
                      <span className="font-medium">{entry.accession || '—'}</span>
                      <p className="break-all font-mono text-[10px] text-muted-foreground">
                        {entry.sop_instance_uid}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(Date.now() - entry.age_s * 1000), 'dd.MM.yyyy HH:mm:ss')}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">{entry.target_name || '—'}</TableCell>
                    <TableCell>{statusBadge(entry)}</TableCell>
                    <TableCell className="text-xs">{entry.attempts}</TableCell>
                    <TableCell className="text-xs">{formatBytes(entry.payload_bytes)}</TableCell>
                    <TableCell className="break-all text-xs text-muted-foreground">
                      {entry.last_error || '—'}
                    </TableCell>
                    <TableCell className="text-right">{actions(entry)}</TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {t('broker.spoolNone')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={discarding !== null} onOpenChange={(open) => { if (!open) setDiscarding(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('broker.spoolDiscardTitle')}</DialogTitle>
            <DialogDescription>{t('broker.spoolDiscardHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="spool-reason">{t('broker.spoolReason')}</Label>
            <Input
              id="spool-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('broker.spoolReasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscarding(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || discard.isPending}
              onClick={() => {
                if (!discarding) return;
                discard.mutate(
                  { id: discarding.id, reason: reason.trim() },
                  { onSuccess: () => setDiscarding(null) },
                );
              }}
            >
              {t('broker.spoolDiscard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  );
}
