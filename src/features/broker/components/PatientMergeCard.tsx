/**
 * PatientMergeCard — IHE PIR: an old patient ID now belongs to the current one.
 *
 * The RIS announces that with an ADT A40; when it does not (or when someone
 * needs it fixed now), the operator can record it here. The effect is the same
 * for both: the worklist answer and the routing provenance use the current ID.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Search, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useCanWrite } from '@/features/broker/hooks/use-can-write';
import { useAuditedMutation } from '@/features/broker/hooks/use-broker-writes';

export function PatientMergeCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const configured = Boolean(getConfig().brokerUrl);
  const { canWrite } = useCanWrite();

  const [oldId, setOldId] = useState('');
  const [newId, setNewId] = useState('');
  const [reason, setReason] = useState('');
  const [probe, setProbe] = useState('');
  const [probeResult, setProbeResult] = useState<string | null>(null);

  const merges = useQuery({
    queryKey: ['broker', 'merges'],
    queryFn: () => brokerApi.patientMerges.list(),
    enabled: configured,
  });

  const create = useAuditedMutation<{ old: string; current: string; reason: string }, unknown>({
    action: 'broker.patient_merge.create',
    resourceType: 'brokerConfig',
    resourceId: (body) => body.old,
    run: (body) => brokerApi.patientMerges.create({
      old_patient_id: body.old, new_patient_id: body.current, reason: body.reason,
    }),
    invalidate: [['broker', 'merges']],
    successMessage: t('broker.pirSaved'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => brokerApi.patientMerges.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['broker', 'merges'] }),
  });

  const resolve = useMutation({
    mutationFn: () => brokerApi.patientMerges.resolve(probe.trim()),
    onSuccess: (result) => setProbeResult(
      result.merged
        ? t('broker.pirResolvedTo', { resolved: result.resolved })
        : t('broker.pirUnchanged'),
    ),
  });

  const rows = merges.data ?? [];

  return (
    <Card data-testid="patient-merge-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t('broker.pirTitle')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('broker.mergeHint')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="merge-old" className="text-xs">{t('broker.pirOld')}</Label>
              <Input id="merge-old" className="h-9 w-[150px] font-mono" value={oldId}
                     onChange={(event) => setOldId(event.target.value)} />
            </div>
            <ArrowRight className="h-4 w-4 mb-2 text-muted-foreground" />
            <div>
              <Label htmlFor="merge-new" className="text-xs">{t('broker.pirNew')}</Label>
              <Input id="merge-new" className="h-9 w-[150px] font-mono" value={newId}
                     onChange={(event) => setNewId(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="merge-reason" className="text-xs">{t('broker.pirReason')}</Label>
              <Input id="merge-reason" className="h-9 w-[200px]" value={reason}
                     placeholder={t('broker.pirReasonHint')}
                     onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button size="sm" disabled={!oldId.trim() || !newId.trim() || create.isPending}
                    onClick={() => {
                      create.mutate({ old: oldId.trim(), current: newId.trim(), reason: reason.trim() });
                      setOldId(''); setNewId(''); setReason('');
                    }}>
              <Plus className="h-4 w-4 mr-1" />
              {t('broker.pirAdd')}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="merge-probe" className="text-xs">{t('broker.pirProbe')}</Label>
            <Input id="merge-probe" className="h-9 w-[180px] font-mono" value={probe}
                   placeholder={t('broker.pirProbeHint')}
                   onChange={(event) => { setProbe(event.target.value); setProbeResult(null); }} />
          </div>
          <Button size="sm" variant="outline" disabled={!probe.trim() || resolve.isPending}
                  onClick={() => resolve.mutate()}>
            <Search className="h-4 w-4 mr-1" />
            {t('broker.pirProbeRun')}
          </Button>
          {probeResult && (
            <span role="status" className="text-xs font-mono" data-testid="merge-probe-result">
              {probeResult}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('broker.pirEmpty')}</p>
        ) : (
          <ul className="space-y-1" data-testid="merge-list">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono">{row.old_patient_id}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono font-medium">{row.new_patient_id}</span>
                <Badge variant={row.origin === 'adt' ? 'secondary' : 'outline'} className="text-[10px]">
                  {row.origin === 'adt' ? t('broker.pirFromAdt') : t('broker.pirManual')}
                </Badge>
                {row.reason && <span className="text-muted-foreground">{row.reason}</span>}
                <span className="ml-auto text-muted-foreground">{row.actor}</span>
                {canWrite && (
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                          aria-label={t('broker.pirUndo')}
                          onClick={() => remove.mutate(row.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
