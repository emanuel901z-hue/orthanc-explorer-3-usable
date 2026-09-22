/**
 * StationMatrixCard — which console sees which sources, side by side.
 *
 * The single-station preview answers one question; before a rollout an operator
 * wants the whole picture: is any console accidentally cut off, or does one see
 * sources it should not? Empty input = every station that has a rule.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Loader2, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { brokerApi, type StationPreview } from '@/api/broker';

export function StationMatrixCard() {
  const { t } = useTranslation();
  const [aets, setAets] = useState('');

  const preview = useMutation({
    mutationFn: () => brokerApi.stationsPreview(
      aets.split(',').map((a) => a.trim()).filter(Boolean),
    ),
  });
  const rows: StationPreview[] = preview.data?.stations ?? [];

  return (
    <Card data-testid="station-matrix">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{t('broker.matrixTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('broker.matrixHint')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="matrix-aets" className="text-xs">{t('broker.matrixStations')}</Label>
            <Input id="matrix-aets" className="h-9 w-[280px] font-mono"
                   placeholder={t('broker.matrixPlaceholder')}
                   value={aets}
                   onChange={(event) => setAets(event.target.value)} />
          </div>
          <Button size="sm" disabled={preview.isPending} onClick={() => preview.mutate()}>
            {preview.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <PlayCircle className="h-4 w-4 mr-1" />}
            {t('broker.matrixRun')}
          </Button>
        </div>

        {preview.isError && (
          <p role="alert" className="text-xs text-destructive">
            {preview.error instanceof Error ? preview.error.message : String(preview.error)}
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto" data-testid="station-matrix-result">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('broker.station')}</TableHead>
                  <TableHead>{t('broker.matrixRule')}</TableHead>
                  <TableHead>{t('broker.matrixVisible')}</TableHead>
                  <TableHead>{t('broker.matrixHidden')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => {
                  const visible = entry.sources.filter((s) => s.visible);
                  const hidden = entry.sources.filter((s) => !s.visible);
                  return (
                    <TableRow key={entry.station_aet}>
                      <TableCell className="font-mono text-xs">
                        {entry.station_aet || t('broker.matrixAny')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.rule_name
                          ? <Badge variant="outline" className="text-[10px]">{entry.rule_name}</Badge>
                          : <span className="text-muted-foreground">{t('broker.matrixNoRule')}</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {visible.length === 0
                          ? <span className="text-destructive">{t('broker.matrixNone')}</span>
                          : visible.map((s) => (
                              <span key={s.id} className="font-mono mr-1">
                                {s.name}
                                <span className="text-muted-foreground">({s.effective_priority})</span>
                              </span>
                            ))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {hidden.map((s) => s.name).join(', ') || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.some((r) => r.sources.every((s) => !s.visible)) && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {t('broker.matrixWarning')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
