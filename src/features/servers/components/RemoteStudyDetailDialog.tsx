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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { queriesApi } from '@/api/queries';
import { formatDicomDate } from '@/lib/dicom-date';
import type { RemoteStudy } from '@/features/servers/lib/remote-study';

type Props = {
  study: RemoteStudy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  targetAet?: string;
  onRetrieve: (study: RemoteStudy) => void;
  onCopy: (study: RemoteStudy) => void;
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
 * Der Aufbau entspricht dem lokalen Studium (Kopfdaten, Kennwerte, Tag-Liste) —
 * nur ohne Serien, weil die Bilder noch nicht hier sind. Die Aktionen zum
 * Holen und Kopieren sitzen unten, damit man nach dem Ansehen direkt
 * entscheiden kann.
 */
export default function RemoteStudyDetailDialog({
  study,
  open,
  onOpenChange,
  locale,
  targetAet,
  onRetrieve,
  onCopy,
}: Props) {
  const { t } = useTranslation();
  const { data: tags, isLoading } = useQuery({
    queryKey: ['remote-answer-content', study?.queryId, study?.answerIndex],
    queryFn: () => queriesApi.getAnswerContentFull(study!.queryId, study!.answerIndex),
    enabled: open && !!study,
    staleTime: 60_000,
  });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
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

        <DialogFooter className="gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => onRetrieve(study)}>
            <Download className="h-4 w-4" />
            {t('remote.retrieve', { defaultValue: 'Retrieve' })}
          </Button>
          <Button className="gap-1.5" disabled={!targetAet} onClick={() => onCopy(study)}>
            <Copy className="h-4 w-4" />
            {targetAet
              ? t('remote.copyTo', { target: targetAet, defaultValue: `Copy to ${targetAet}` })
              : t('remote.copyNoTarget', { defaultValue: 'Choose a target first' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
