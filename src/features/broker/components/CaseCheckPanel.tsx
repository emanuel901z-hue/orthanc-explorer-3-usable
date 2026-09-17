/**
 * "Check a case" — dry-run of routing and modify rules.
 *
 * The operator pastes an accession (or study UID) plus optional tag values and
 * sees exactly where the instance would go and how its tags would change. The
 * backend runs the same resolver as the live path, so the answer is binding.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { brokerApi, type TransformSimulation } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { ConfigDiffTable } from './ConfigDiffTable';

/** Parse "Tag=Value" lines into a tag map (DAU-friendly input format). */
export function parseTagValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [tag, ...rest] = trimmed.split('=');
    if (rest.length === 0) continue;
    out[tag.trim()] = rest.join('=').trim();
  }
  return out;
}

export function CaseCheckPanel() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);

  const [accession, setAccession] = useState('');
  const [studyUid, setStudyUid] = useState('');
  const [values, setValues] = useState('');

  const simulation = useMutation<TransformSimulation, Error, void>({
    mutationFn: () => brokerApi.simulate.transform({
      accession: accession.trim(),
      study_uid: studyUid.trim(),
      values: parseTagValues(values),
    }),
  });

  const result = simulation.data;
  const before = Object.fromEntries(
    (result?.changes ?? []).map((change) => [change.tag, change.before]),
  );
  const after = Object.fromEntries(
    (result?.changes ?? []).map((change) => [change.tag, change.after]),
  );

  return (
    <Card data-testid="broker-case-check">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{t('broker.caseCheckTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('broker.caseCheckHint')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="case-accession">{t('broker.caseCheckAccession')}</Label>
            <Input
              id="case-accession"
              value={accession}
              onChange={(e) => setAccession(e.target.value)}
              placeholder="ACC-A-001"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="case-study">{t('broker.caseCheckStudyUid')}</Label>
            <Input
              id="case-study"
              value={studyUid}
              onChange={(e) => setStudyUid(e.target.value)}
              placeholder="1.2.840…"
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="case-values">{t('broker.caseCheckValues')}</Label>
          <Textarea
            id="case-values"
            value={values}
            onChange={(e) => setValues(e.target.value)}
            rows={3}
            placeholder={'PatientID=P1\nInstitutionName=ALT'}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">{t('broker.caseCheckValuesHint')}</p>
        </div>

        <Button
          size="sm"
          disabled={!configured || simulation.isPending || (!accession.trim() && !studyUid.trim())}
          onClick={() => simulation.mutate()}
        >
          <PlayCircle className="h-4 w-4 mr-1" />
          {simulation.isPending ? t('broker.caseCheckRunning') : t('broker.caseCheckRun')}
        </Button>

        {simulation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {simulation.error?.message}
          </p>
        )}

        {result && (
          <div className="space-y-3 rounded-md border p-3" data-testid="case-check-result">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={result.target_id ? 'secondary' : 'destructive'}>
                {result.matched_via === 'default'
                  ? t('broker.caseCheckDefault')
                  : t(`broker.caseCheckVia_${result.matched_via}`)}
              </Badge>
              <span className="font-mono text-xs">
                {result.source_name ?? '—'} → {result.target_name ?? t('broker.caseCheckNoTarget')}
              </span>
              {result.rule_id !== null && (
                <Badge variant="outline" className="text-[10px]">
                  {t('broker.caseCheckRule', { id: result.rule_id })}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{result.reason}</p>

            {result.rules_applied.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted-foreground">{t('broker.caseCheckRulesApplied')}:</span>
                {result.rules_applied.map((name) => (
                  <Badge key={name} variant="outline" className="text-[10px] font-mono">{name}</Badge>
                ))}
              </div>
            )}

            <ConfigDiffTable before={before} after={after} />

            {result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                <p className="text-xs font-medium text-destructive">{t('broker.caseCheckErrors')}</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-destructive">
                  {result.errors.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
