/**
 * MergeRulesCard — which source wins for a single DICOM attribute.
 *
 * The default merge takes the whole item from the highest-priority source that
 * knows the case. Sometimes one field should come from somewhere else (patient
 * demographics from the HIS feed while the study description comes from the
 * RIS). The card lets an operator name the attribute and the order of sources.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { brokerApi, type BrokerSource, type MergeRule } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useCanWrite } from '@/features/broker/hooks/use-can-write';
import { useAuditedMutation } from '@/features/broker/hooks/use-broker-writes';

export function MergeRulesCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const queryClient = useQueryClient();
  const { canWrite } = useCanWrite();
  const [tag, setTag] = useState('');
  const [sources, setSources] = useState('');

  const rulesQuery = useQuery({
    queryKey: ['broker', 'merge-rules'],
    queryFn: () => brokerApi.mergeRules.list(),
    enabled: configured,
  });
  const sourcesQuery = useQuery({
    queryKey: ['broker', 'sources'],
    queryFn: () => brokerApi.sources.list(),
    enabled: configured,
  });

  type MergeRuleForm = { tag: string; sources: string[] };
  const save = useAuditedMutation<MergeRuleForm, MergeRule>({
    action: 'broker.merge_rule.create',
    resourceType: 'brokerConfig',
    resourceId: (body) => body.tag,
    run: (body) => brokerApi.mergeRules.create(body),
    invalidate: [['broker', 'merge-rules']],
    successMessage: t('broker.saved'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => brokerApi.mergeRules.remove(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['broker', 'merge-rules'] }),
  });

  const rules = rulesQuery.data ?? [];
  const available = (sourcesQuery.data ?? []).map((s: BrokerSource) => s.name);
  const parsed = sources.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <Card data-testid="merge-rules-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{t('broker.mergeTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('broker.mergeHint')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length > 0 && (
          <ul className="space-y-1" data-testid="merge-rules-list">
            {rules.map((rule: MergeRule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-medium">{rule.tag}</span>
                <span className="text-muted-foreground">←</span>
                {rule.sources.map((source, index) => (
                  <Badge key={source} variant={index === 0 ? 'default' : 'outline'}
                         className="text-[10px]">
                    {index + 1}. {source}
                  </Badge>
                ))}
                {!rule.enabled && <Badge variant="secondary">{t('broker.mergeOff')}</Badge>}
                {canWrite && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          aria-label={t('broker.mergeDelete', { tag: rule.tag })}
                          onClick={() => remove.mutate(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {rules.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('broker.mergeEmpty')}</p>
        )}

        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="merge-tag" className="text-xs">{t('broker.mergeTag')}</Label>
              <Input id="merge-tag" className="h-9 w-[190px] font-mono"
                     placeholder="PatientName"
                     value={tag}
                     onChange={(event) => setTag(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="merge-sources" className="text-xs">{t('broker.mergeSources')}</Label>
              <Input id="merge-sources" className="h-9 w-[240px] font-mono"
                     placeholder={available.slice(0, 2).join(', ') || 'ris-a, ris-b'}
                     value={sources}
                     onChange={(event) => setSources(event.target.value)} />
            </div>
            <Button size="sm" disabled={save.isPending || !tag.trim() || parsed.length === 0}
                    onClick={() => save.mutate({ tag: tag.trim(), sources: parsed },
                                               { onSuccess: () => { setTag(''); setSources(''); } })}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              : <Plus className="h-4 w-4 mr-1" />}
              {t('broker.mergeAddField')}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('broker.mergeSourcesHint')}</p>
        {save.isError && (
          <p role="alert" className="text-xs text-destructive">
            {save.error instanceof Error ? save.error.message : String(save.error)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
