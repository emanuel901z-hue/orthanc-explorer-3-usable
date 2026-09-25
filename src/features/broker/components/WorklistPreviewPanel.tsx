/**
 * WorklistPreviewPanel — "what would this console actually receive?"
 *
 * Runs the real C-FIND aggregation (fan-out, merge, dedupe, station rules,
 * cache) and shows the merged items with their provenance, so a wrong
 * configuration is visible before a modality notices it. PHI-free by default;
 * patient name/ID appear only when the operator switched `simulate_show_phi` on
 * (the health panel reports that).
 */
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Loader2, PlayCircle, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { brokerApi } from '@/api/broker';
import { usePersistedState, useRememberedState } from '@/store/ui-state';

export function WorklistPreviewPanel() {
  const { t } = useTranslation();
  // The station persists; the accession number is PHI-adjacent — memory only.
  const [station, setStation] = usePersistedState('worklistPreview.station', '');
  const [accession, setAccession] = useRememberedState('worklistPreview.accession', '');

  const preview = useMutation({
    mutationFn: () => brokerApi.worklistPreview({
      ...(station ? { station_aet: station } : {}),
      ...(accession ? { accession } : {}),
    }),
  });
  const result = preview.data;

  return (
    <Card data-testid="worklist-preview">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{t('broker.previewTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('broker.previewHint')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="preview-station" className="text-xs">{t('broker.previewStation')}</Label>
            <Input
              id="preview-station"
              className="h-9 w-[150px] font-mono"
              placeholder="CT_01"
              value={station}
              onChange={(event) => setStation(event.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label htmlFor="preview-accession" className="text-xs">{t('broker.previewAccession')}</Label>
            <Input
              id="preview-accession"
              className="h-9 w-[180px] font-mono"
              placeholder={t('broker.previewAccessionPlaceholder')}
              value={accession}
              onChange={(event) => setAccession(event.target.value)}
            />
          </div>
          <Button size="sm" disabled={preview.isPending} onClick={() => preview.mutate()}>
            {preview.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <PlayCircle className="h-4 w-4 mr-1" />}
            {preview.isPending ? t('broker.previewRunning') : t('broker.previewRun')}
          </Button>
        </div>

        {preview.isError && (
          <p role="alert" className="text-sm text-destructive">
            {preview.error instanceof Error ? preview.error.message : String(preview.error)}
          </p>
        )}

        {result && (
          <div className="space-y-3" data-testid="preview-result">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={result.answers > 0 ? 'default' : 'destructive'}>
                {t('broker.previewAnswers', { count: result.answers })}
              </Badge>
              <span className="text-muted-foreground">{result.duration_ms} ms</span>
              {result.rule && (
                <span className="text-muted-foreground">
                  {t('broker.previewRule', { rule: result.rule })}
                </span>
              )}
              {result.hidden > 0 && (
                <Badge variant="secondary">
                  {t('broker.previewHidden', { count: result.hidden })}
                </Badge>
              )}
              {result.phi && (
                <Badge variant="destructive" data-testid="preview-phi">
                  <TriangleAlert className="h-3 w-3 mr-1" />
                  {t('broker.previewPhi')}
                </Badge>
              )}
            </div>

            {/* per-source contribution: who answered, who was skipped, who was stale */}
            <div className="flex flex-wrap gap-2 text-xs">
              {result.sources.map((source) => (
                <span key={source.name} className="rounded border px-2 py-1">
                  <span className="font-mono">{source.name}</span>
                  {': '}
                  {typeof source.answers === 'number'
                    ? source.answers
                    : t(`broker.previewSource_${source.answers}`, { defaultValue: String(source.answers) })}
                  {source.stale && (
                    <span className="text-amber-600"> · {t('broker.previewStale')}</span>
                  )}
                </span>
              ))}
            </div>

            {(result.field_changes ?? []).length > 0 && (
              <div className="rounded border p-2 text-xs" data-testid="preview-field-changes">
                <p className="font-medium">{t('broker.previewFieldChanges')}</p>
                <ul className="mt-1 space-y-0.5 font-mono">
                  {(result.field_changes ?? []).slice(0, 5).map((change, index) => (
                    <li key={index}>
                      {change.accession}: {change.tag} ← {change.from}
                      {' '}({change.before || '—'} → {change.after})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('broker.previewEmpty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('broker.accession')}</TableHead>
                      <TableHead>{t('broker.modality')}</TableHead>
                      <TableHead>{t('broker.station')}</TableHead>
                      <TableHead>{t('broker.startDate')}</TableHead>
                      <TableHead>{t('broker.previewFrom')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((item, index) => (
                      <TableRow key={`${item.accession}-${item.sps_id}-${index}`}>
                        <TableCell className="font-mono text-xs">{item.accession}</TableCell>
                        <TableCell>{item.modality}</TableCell>
                        <TableCell className="font-mono text-xs">{item.station_aet}</TableCell>
                        <TableCell className="text-xs">{item.start_date}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-mono">{item.source}</span>
                          {item.also_in.length > 0 && (
                            <span className="text-muted-foreground">
                              {' '}(+{item.also_in.join(', ')})
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result.truncated && (
              <p className="text-xs text-muted-foreground">{t('broker.previewTruncated')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
