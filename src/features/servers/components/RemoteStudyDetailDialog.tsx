import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { queriesApi } from '@/api/queries';
import { queryModalityAction } from '@/actions/queryModality';
import { formatDicomDate } from '@/lib/dicom-date';
import type { RemoteStudy } from '@/features/servers/lib/remote-study';

type Props = {
  study: RemoteStudy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  /** Quell-AET — wird für C-FIND/C-MOVE gebraucht. */
  modality: string;
  targets: { aet: string; label?: string }[];
  targetAet: string;
  onTargetChange: (aet: string) => void;
  onRetrieveStudy: (study: RemoteStudy) => void;
  onCopyStudy: (study: RemoteStudy) => void;
  onRetrieveSeries: (study: RemoteStudy, series: RemoteSeries[]) => void;
  onCopySeries: (study: RemoteStudy, series: RemoteSeries[]) => void;
};

export type RemoteSeries = {
  seriesInstanceUid: string;
  description: string;
  modality: string;
  number: string;
  instances: string;
};

type FullTag = { Name?: string; Type?: string; Value?: string | string[] };

function tagValue(tag: FullTag | string | undefined): string {
  if (tag === undefined) return '';
  if (typeof tag === 'string') return tag;
  if (Array.isArray(tag.Value)) return tag.Value.join(' \\ ');
  return tag.Value ?? '';
}

/**
 * Detailansicht einer Studie aus dem entfernten Archiv.
 *
 * Aufbau wie beim lokalen Studium (Kopfdaten, Kennwerte, Tags) — zusätzlich die
 * **Serienliste**: nur einzelne Serien kopieren geht damit, ohne die ganze
 * Studie zu übertragen. Die Zielauswahl sitzt direkt im Dialog, damit man nach
 * dem Ansehen nicht zurück auf die Seite springen muss.
 */
export default function RemoteStudyDetailDialog({
  study,
  open,
  onOpenChange,
  locale,
  modality,
  targets,
  targetAet,
  onTargetChange,
  onRetrieveStudy,
  onCopyStudy,
  onRetrieveSeries,
  onCopySeries,
}: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: tags, isLoading } = useQuery({
    queryKey: ['remote-answer-content', study?.queryId, study?.answerIndex],
    queryFn: () => queriesApi.getAnswerContentFull(study!.queryId, study!.answerIndex),
    enabled: open && !!study,
    staleTime: 60_000,
  });

  // Serien erst holen, wenn der Dialog offen ist — ein C-FIND auf Serien-Ebene
  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ['remote-series', modality, study?.studyInstanceUid],
    queryFn: async (): Promise<RemoteSeries[]> => {
      const result = await queryModalityAction(modality, {
        Level: 'Series',
        Query: {
          StudyInstanceUID: study!.studyInstanceUid,
          SeriesInstanceUID: '',
          SeriesDescription: '',
          SeriesNumber: '',
          Modality: '',
          NumberOfSeriesRelatedInstances: '',
        },
      });
      return result.answers.map((answer) => ({
        seriesInstanceUid: answer.tags['SeriesInstanceUID'] ?? answer.tags['0020,000e'] ?? '',
        description: answer.tags['SeriesDescription'] ?? answer.tags['0008,103e'] ?? '—',
        modality: answer.tags['Modality'] ?? answer.tags['0008,0060'] ?? '—',
        number: answer.tags['SeriesNumber'] ?? answer.tags['0020,0011'] ?? '—',
        instances: answer.tags['NumberOfSeriesRelatedInstances'] ?? answer.tags['0020,1209'] ?? '—',
      }));
    },
    enabled: open && !!study && !!modality && study.studyInstanceUid.length > 0,
    staleTime: 60_000,
  });

  // Voreinstellung: alle Serien ausgewählt (der Normalfall ist „alles“)
  useEffect(() => {
    if (series) setSelected(new Set(series.map((entry) => entry.seriesInstanceUid)));
  }, [series]);

  const selectedSeries = useMemo(
    () => (series ?? []).filter((entry) => selected.has(entry.seriesInstanceUid)),
    [series, selected],
  );

  if (!study) return null;

  const facts: { label: string; value: string }[] = [
    { label: t('remote.patientId', { defaultValue: 'Patient ID' }), value: study.patientId },
    {
      label: t('remote.searchKind.birthDate', { defaultValue: 'Birth date' }),
      value: study.birthDate ? formatDicomDate(study.birthDate, locale) : '—',
    },
    {
      label: t('remote.searchKind.studyDate', { defaultValue: 'Study date' }),
      value: study.studyDate === '—' ? '—' : formatDicomDate(study.studyDate, locale),
    },
    { label: t('remote.studyDescription', { defaultValue: 'Study description' }), value: study.studyDescription },
    { label: t('remote.accessionNumber', { defaultValue: 'Accession number' }), value: study.accessionNumber },
    { label: t('remote.searchKind.modality', { defaultValue: 'Modality' }), value: study.modalities },
    { label: 'StudyInstanceUID', value: study.studyInstanceUid },
  ];

  const rows = Object.entries(tags ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const seriesCount = selectedSeries.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{study.patientName}</DialogTitle>
          <DialogDescription>
            {study.patientId}
            {study.birthDate ? ` · ${formatDicomDate(study.birthDate, locale)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto space-y-4 pr-1">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className={fact.label === 'StudyInstanceUID' ? 'font-mono text-xs break-all' : ''}>
                  {fact.value || '—'}
                </dd>
              </div>
            ))}
          </dl>

          {/* Serien: einzelne auswählen und nur die übertragen */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('remote.seriesTitle', { defaultValue: 'Series' })}
                {series ? ` · ${series.length}` : ''}
              </div>
              {series && series.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setSelected(new Set(series.map((entry) => entry.seriesInstanceUid)))}
                  >
                    {t('remote.selectAll', { defaultValue: 'Select all' })}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelected(new Set())}>
                    {t('remote.selectNone', { defaultValue: 'None' })}
                  </Button>
                </div>
              )}
            </div>

            {seriesLoading ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                {t('remote.seriesLoading', { defaultValue: 'Loading series…' })}
              </div>
            ) : !series || series.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('remote.seriesEmpty', { defaultValue: 'The archive returned no series for this study.' })}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]" />
                    <TableHead className="w-[70px]">{t('remote.seriesNumber', { defaultValue: 'No.' })}</TableHead>
                    <TableHead className="w-[90px]">{t('remote.searchKind.modality', { defaultValue: 'Modality' })}</TableHead>
                    <TableHead>{t('remote.seriesDescription', { defaultValue: 'Description' })}</TableHead>
                    <TableHead className="w-[90px]">{t('remote.seriesInstances', { defaultValue: 'Images' })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((entry) => (
                    <TableRow
                      key={entry.seriesInstanceUid}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(entry.seriesInstanceUid)) next.delete(entry.seriesInstanceUid);
                          else next.add(entry.seriesInstanceUid);
                          return next;
                        })
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(entry.seriesInstanceUid)}
                          onCheckedChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(entry.seriesInstanceUid)) next.delete(entry.seriesInstanceUid);
                              else next.add(entry.seriesInstanceUid);
                              return next;
                            })
                          }
                          aria-label={t('remote.seriesSelect', { defaultValue: 'Select series' })}
                        />
                      </TableCell>
                      <TableCell className="text-sm font-mono">{entry.number}</TableCell>
                      <TableCell className="text-sm font-mono">{entry.modality}</TableCell>
                      <TableCell className="text-sm">{entry.description}</TableCell>
                      <TableCell className="text-sm">{entry.instances}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {t('remote.detailTags', { defaultValue: 'DICOM tags from the archive' })}
            </div>
            {isLoading ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                {t('remote.detailLoading', { defaultValue: 'Loading tags…' })}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('remote.detailNoTags', { defaultValue: 'The archive returned no tags for this study.' })}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Tag</TableHead>
                    <TableHead className="w-[180px]">{t('remote.detailTagName', { defaultValue: 'Name' })}</TableHead>
                    <TableHead>{t('remote.detailTagValue', { defaultValue: 'Value' })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(([tagId, tag]) => (
                    <TableRow key={tagId}>
                      <TableCell className="font-mono text-xs">{tagId}</TableCell>
                      <TableCell className="text-xs">{typeof tag === 'object' ? tag.Name ?? '' : ''}</TableCell>
                      <TableCell className="text-xs break-all">{tagValue(tag as FullTag)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap items-center">
          {/* Ziel direkt hier wählen — kein Sprung zurück auf die Seite */}
          <label htmlFor="detail-target" className="text-xs text-muted-foreground">
            {t('remote.copyTarget', { defaultValue: 'Copy to' })}
          </label>
          <select
            id="detail-target"
            aria-label={t('remote.copyTarget', { defaultValue: 'Copy to' })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={targetAet}
            onChange={(e) => onTargetChange(e.target.value)}
          >
            <option value="">
              {targets.length === 0
                ? t('remote.copyTargetsEmpty', { defaultValue: 'No targets configured' })
                : t('remote.copyTargetNone', { defaultValue: '— target —' })}
            </option>
            {targets.map((target) => (
              <option key={target.aet} value={target.aet}>
                {target.label ? `${target.label} (${target.aet})` : target.aet}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => (seriesCount > 0 ? onRetrieveSeries(study, selectedSeries) : onRetrieveStudy(study))}
          >
            <Download className="h-4 w-4" />
            {seriesCount > 0
              ? t('remote.retrieveSeriesCount', { count: seriesCount, defaultValue: `Retrieve ${seriesCount} series` })
              : t('remote.retrieve', { defaultValue: 'Retrieve' })}
          </Button>
          <Button
            className="gap-1.5"
            disabled={!targetAet}
            onClick={() => (seriesCount > 0 ? onCopySeries(study, selectedSeries) : onCopyStudy(study))}
          >
            <Copy className="h-4 w-4" />
            {!targetAet
              ? t('remote.copyNoTarget', { defaultValue: 'Choose a target first' })
              : seriesCount > 0
                ? t('remote.copySeriesCount', { count: seriesCount, defaultValue: `Copy ${seriesCount} series` })
                : t('remote.copy', { defaultValue: 'Copy' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
