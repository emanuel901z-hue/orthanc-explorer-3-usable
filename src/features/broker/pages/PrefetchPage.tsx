/**
 * PrefetchPage — prior studies for a reading station ("Voraufnahmen holen").
 *
 * The tool a radiographer/radiologist actually uses: enter the patient, see
 * which earlier studies the PACS knows, then pull them in. The broker runs a
 * study-level C-FIND and a C-MOVE for this — it is a query/retrieve *client*
 * here (it never offers C-MOVE itself).
 *
 * DAU guard rails, on purpose:
 *  - nothing moves before a preview ran (the "Holen" button stays disabled
 *    until the found studies are on screen),
 *  - the preview is always the first step, and it says what it will do,
 *  - the patient ID is PHI, so it lives in memory only (`useRememberedState`),
 *    never in localStorage,
 *  - "Holen" needs the write role (the dry run does not — looking is safe).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '@/lib/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  brokerApi,
  type PrefetchRequest,
  type PrefetchResult,
} from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useCanWrite } from '../hooks/use-can-write';
import { BrokerPageShell } from '../components/BrokerPageShell';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { usePersistedState, useRememberedState } from '@/store/ui-state';

function ErrorCard({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-3 text-sm text-destructive break-words">
        {describeError(error, t)}
      </CardContent>
    </Card>
  );
}

export default function PrefetchPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const configured = Boolean(getConfig().brokerUrl);
  const { canWrite } = useCanWrite();

  // the patient ID is PHI: memory only, never persisted
  const [patientId, setPatientId] = useRememberedState('broker.prefetch.patient', '');
  const [queryNode, setQueryNode] = usePersistedState('broker.prefetch.node', '');
  const [destination, setDestination] = usePersistedState('broker.prefetch.destination', '');
  const [modality, setModality] = usePersistedState('broker.prefetch.modality', '');
  const [maxStudies, setMaxStudies] = usePersistedState('broker.prefetch.max', '5');
  const [excludeStudy, setExcludeStudy] = usePersistedState('broker.prefetch.exclude', '');

  const [plan, setPlan] = useState<PrefetchResult | null>(null);
  const [result, setResult] = useState<PrefetchResult | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const targetsQuery = useQuery({
    queryKey: ['broker', 'targets'],
    queryFn: () => brokerApi.targets.list(),
    enabled: configured,
  });
  const targets = targetsQuery.data ?? [];

  const subscriptionsQuery = useQuery({
    queryKey: ['broker', 'ups-subscriptions'],
    queryFn: brokerApi.upsSubscriptions.list,
    enabled: configured,
  });

  const removeSubscription = useMutation({
    mutationFn: (aet: string) => brokerApi.upsSubscriptions.remove(aet),
    onSuccess: () => {
      toast.success(t('broker.prefetchSubscriptionRemoved'));
      queryClient.invalidateQueries({ queryKey: ['broker', 'ups-subscriptions'] });
    },
    onError: (error) => toast.error(describeError(error, t)),
  });

  const body = (): PrefetchRequest => ({
    patient_id: patientId.trim(),
    query_node: queryNode,
    destination,
    ...(modality.trim() ? { modality: modality.trim() } : {}),
    ...(excludeStudy.trim() ? { exclude_study_uid: excludeStudy.trim() } : {}),
    max_studies: Number(maxStudies) || 5,
  });

  const incomplete = !patientId.trim() || !queryNode || !destination;

  const preview = useMutation({
    mutationFn: () => brokerApi.prefetch.run(body(), true),
    onSuccess: (data) => { setPlan(data); setResult(null); },
  });

  const apply = useMutation({
    mutationFn: () => brokerApi.prefetch.run(body(), false),
    onSuccess: (data) => {
      setResult(data);
      const moved = data.moved.filter((move) => move.ok).length;
      if (data.moved.length === 0) {
        toast.success(t('broker.prefetchNothingToMove'));
      } else if (moved === data.moved.length) {
        toast.success(t('broker.prefetchMoved', { count: moved }));
      } else {
        toast.error(t('broker.prefetchPartlyMoved', {
          moved, total: data.moved.length,
        }));
      }
    },
    onError: (error) => toast.error(describeError(error, t)),
  });

  if (!configured) {
    return (
      <BrokerPageShell helpId="prefetch" titleKey="broker.prefetchTitle"
                       subtitleKey="broker.prefetchSubtitle">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 text-sm text-warning">
            {t('broker.notConfigured')}
          </CardContent>
        </Card>
      </BrokerPageShell>
    );
  }

  const studies = plan?.studies ?? [];

  return (
    <BrokerPageShell helpId="prefetch" titleKey="broker.prefetchTitle"
                     subtitleKey="broker.prefetchSubtitle">
      <div className="space-y-3">
        {!canWrite && (
          <Card className="border-warning/30 bg-warning/5" data-testid="prefetch-readonly">
            <CardContent className="p-3 text-sm text-warning">
              {t('broker.prefetchReadOnly')}
            </CardContent>
          </Card>
        )}

        {/* 1 — what should be fetched */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('broker.prefetchStep1')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="prefetch-patient">{t('broker.patientId')}</Label>
              <Input
                id="prefetch-patient"
                value={patientId}
                data-shortcut="search"
                autoComplete="off"
                placeholder={t('broker.prefetchPatientPlaceholder')}
                onChange={(event) => setPatientId(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prefetch-node">{t('broker.prefetchQueryNode')}</Label>
              <select
                id="prefetch-node"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={queryNode}
                onChange={(event) => setQueryNode(event.target.value)}
              >
                <option value="">{t('broker.prefetchChoose')}</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.name}>{target.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t('broker.prefetchQueryNodeHint')}</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prefetch-destination">{t('broker.prefetchDestination')}</Label>
              <select
                id="prefetch-destination"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">{t('broker.prefetchChoose')}</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.name}>{target.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t('broker.prefetchDestinationHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prefetch-modality">{t('broker.modality')}</Label>
                <Input
                  id="prefetch-modality"
                  value={modality}
                  placeholder="CT"
                  onChange={(event) => setModality(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prefetch-max">{t('broker.prefetchMax')}</Label>
                <Input
                  id="prefetch-max"
                  type="number"
                  min={1}
                  max={50}
                  value={maxStudies}
                  onChange={(event) => setMaxStudies(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prefetch-exclude">{t('broker.prefetchExclude')}</Label>
              <Input
                id="prefetch-exclude"
                value={excludeStudy}
                placeholder="1.2.840.113619…"
                onChange={(event) => setExcludeStudy(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('broker.prefetchExcludeHint')}</p>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <Button
                disabled={incomplete || preview.isPending}
                onClick={() => preview.mutate()}
              >
                {preview.isPending
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <Search className="h-4 w-4 mr-1" />}
                {t('broker.prefetchPreview')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t('broker.prefetchPreviewHint')}
              </span>
            </div>

            {preview.isError && <div className="sm:col-span-2"><ErrorCard error={preview.error} /></div>}
          </CardContent>
        </Card>

        {/* 2 — what was found, and the one button that moves something */}
        {plan && (
          <Card data-testid="prefetch-plan">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {t('broker.prefetchStep2')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {studies.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('broker.prefetchNone')}</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('broker.prefetchDate')}</TableHead>
                        <TableHead>{t('broker.modality')}</TableHead>
                        <TableHead>{t('broker.prefetchDescription')}</TableHead>
                        <TableHead>{t('broker.prefetchInstances')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studies.map((study) => (
                        <TableRow key={study.study_uid}>
                          <TableCell className="text-xs whitespace-nowrap">{study.study_date}</TableCell>
                          <TableCell className="text-xs">{study.modalities || '—'}</TableCell>
                          <TableCell className="text-xs">{study.description || '—'}</TableCell>
                          <TableCell className="text-xs">{study.instances || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={apply.isPending || !canWrite}
                      onClick={() => apply.mutate()}
                    >
                      {apply.isPending
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <Download className="h-4 w-4 mr-1" />}
                      {t('broker.prefetchApply', { count: studies.length })}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {t('broker.prefetchApplyHint', { aet: plan.destination_aet })}
                    </span>
                  </div>
                </>
              )}

              {apply.isError && <ErrorCard error={apply.error} />}

              {result && (
                <div className="space-y-2" data-testid="prefetch-result">
                  {result.moved.map((move) => (
                    <div key={move.study_uid} className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={move.ok ? 'secondary' : 'destructive'} className="text-[10px]">
                        {move.ok ? t('broker.prefetchOk') : t('broker.prefetchFailed')}
                      </Badge>
                      <span className="font-mono break-all">{move.study_uid}</span>
                      <span className="text-muted-foreground">
                        {t('broker.prefetchInstancesMoved', { completed: move.completed })}
                      </span>
                      {move.error && <span className="text-destructive">{move.error}</span>}
                    </div>
                  ))}
                  {result.skipped.length > 0 && (
                    <p className="text-xs text-amber-600">
                      {t('broker.prefetchSkipped', { count: result.skipped.length })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3 — who receives work item events (created by the client) */}
        <Card data-testid="prefetch-subscriptions">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('broker.prefetchSubscriptionsTitle')}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('broker.prefetchSubscriptionsHint')}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {(subscriptionsQuery.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t('broker.prefetchSubscriptionsEmpty')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('broker.prefetchSubscriber')}</TableHead>
                    <TableHead>{t('broker.prefetchWorkitem')}</TableHead>
                    <TableHead>{t('broker.prefetchDeletionLock')}</TableHead>
                    <TableHead className="w-[60px]">{t('broker.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subscriptionsQuery.data ?? []).map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-mono text-xs">{subscription.subscriber_aet}</TableCell>
                      <TableCell className="font-mono text-xs break-all">
                        {subscription.workitem_uid || t('broker.prefetchAllItems')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {subscription.deletion_lock ? t('common.yes', { defaultValue: 'yes' })
                                                    : t('common.no', { defaultValue: 'no' })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('broker.delete')}
                          disabled={!canWrite}
                          onClick={() => setConfirmRemove(subscription.subscriber_aet)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <ConfirmDeleteDialog
          open={confirmRemove !== null}
          onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}
          itemName={confirmRemove ?? ''}
          pending={removeSubscription.isPending}
          onConfirm={() => {
            if (confirmRemove) removeSubscription.mutate(confirmRemove);
            setConfirmRemove(null);
          }}
        />
      </div>
    </BrokerPageShell>
  );
}
