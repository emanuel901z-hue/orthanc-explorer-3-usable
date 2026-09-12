/**
 * QuickReportDialog — Printable study summary (OE2 "Quick-Report" equivalent).
 *
 * Shows a modal with study metadata + series list, with a "Print" button
 * that opens the browser print dialog (user can save as PDF).
 */
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Printer, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Study } from '@/shared/types';
import { formatPatientName, ModalityBadge } from '@/shared/components/ModalityBadge';
import { useStudySeries } from '@/features/studies/hooks/use-studies';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useState, useMemo } from 'react';

interface QuickReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  study: Study | null;
}

export default function QuickReportDialog({ open, onOpenChange, study }: QuickReportDialogProps) {
  const { t } = useTranslation();
  const [isPrinting, setIsPrinting] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const { data: seriesRaw = [], isLoading: seriesLoading } = useStudySeries(study?.id ?? '');

  // Always sort the report's series table by series number — Orthanc
  // returns them in arbitrary order.
  const series = useMemo(
    () => [...seriesRaw].sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0)),
    [seriesRaw],
  );

  if (!study) return null;

  const sex = study.patientSex
    ? study.patientSex === 'M'
      ? t('studyDetail.sexMale', { defaultValue: 'Male' })
      : study.patientSex === 'F'
        ? t('studyDetail.sexFemale', { defaultValue: 'Female' })
        : t('studyDetail.sexOther', { defaultValue: 'Other' })
    : '—';

  const formatMeta = (value: string | undefined) => value && value.trim() ? value : '—';

  const handlePrint = () => {
    setIsPrinting(true);
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    const rows = series
      .map(
        (s, i) => `<tr>
          <td>${s.seriesNumber ?? i + 1}</td>
          <td>${s.modality}</td>
          <td>${s.seriesDescription || '—'}</td>
          <td>${s.numberOfInstances}</td>
        </tr>`
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="${t('common.lang', { defaultValue: 'en' })}">
<head>
<meta charset="utf-8">
<title>${formatPatientName(study.patientName)} — ${t('quickReport.title', { defaultValue: 'Quick Report' })}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #333; }
  h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #ddd; font-size: 13px; }
  th { background: #f5f5f5; font-weight: 600; }
  .meta { display: grid; grid-template-columns: 200px 1fr; gap: 4px 16px; margin: 16px 0; }
  .meta dt { font-weight: 600; color: #666; }
  .meta dd { margin: 0; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
  <h1>${t('quickReport.title', { defaultValue: 'Quick Report' })}</h1>
  <dl class="meta">
    <dt>${t('quickReport.patientName', { defaultValue: 'Patient Name' })}</dt><dd>${formatPatientName(study.patientName)}</dd>
    <dt>${t('quickReport.patientId', { defaultValue: 'Patient ID' })}</dt><dd>${study.patientId}</dd>
    <dt>${t('quickReport.birthDate', { defaultValue: 'Birth Date' })}</dt><dd>${study.patientBirthDate ? format(study.patientBirthDate, 'PPP') : '—'}</dd>
    <dt>${t('quickReport.sex', { defaultValue: 'Sex' })}</dt><dd>${sex}</dd>
    <dt>${t('quickReport.studyDate', { defaultValue: 'Study Date' })}</dt><dd>${study.studyDate ? format(study.studyDate, 'PPP') : '—'}</dd>
    <dt>${t('quickReport.studyTime', { defaultValue: 'Study Time' })}</dt><dd>${formatMeta(study.studyTime)}</dd>
    <dt>${t('quickReport.modality', { defaultValue: 'Modality' })}</dt><dd>${study.modalities.join(', ')}</dd>
    <dt>${t('quickReport.studyDescription', { defaultValue: 'Study Description' })}</dt><dd>${formatMeta(study.studyDescription)}</dd>
    <dt>${t('quickReport.accessionNumber', { defaultValue: 'Accession Number' })}</dt><dd>${formatMeta(study.accessionNumber)}</dd>
    <dt>${t('quickReport.referringPhysician', { defaultValue: 'Referring Physician' })}</dt><dd>${formatMeta(study.referringPhysician?.replace(/\^/g, ', '))}</dd>
    <dt>${t('quickReport.studyInstanceUID', { defaultValue: 'Study Instance UID' })}</dt><dd>${formatMeta(study.studyInstanceUID)}</dd>
    <dt>${t('quickReport.numberOfSeries', { defaultValue: 'Number of Series' })}</dt><dd>${study.numberOfSeries}</dd>
    <dt>${t('quickReport.numberOfInstances', { defaultValue: 'Number of Instances' })}</dt><dd>${study.numberOfInstances}</dd>
  </dl>
  <h2>${t('quickReport.series', { defaultValue: 'Series' })}</h2>
  <table>
    <thead><tr>
      <th>${t('quickReport.seriesNumber', { defaultValue: '#' })}</th>
      <th>${t('studies.modality', { defaultValue: 'Modality' })}</th>
      <th>${t('quickReport.seriesDescription', { defaultValue: 'Description' })}</th>
      <th>${t('quickReport.seriesInstances', { defaultValue: 'Instances' })}</th>
    </tr></thead>
    <tbody>
      ${rows || `<tr><td colspan="4" class="text-center">${t('quickReport.noSeries', { defaultValue: 'No series data loaded' })}</td></tr>`}
    </tbody>
  </table>
  <div class="footer">${t('quickReport.footer', { date: format(new Date(), 'PPP p'), defaultValue: `Generated by Orthanc Explorer 3 on ${format(new Date(), 'PPP p')}` })}</div>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setIsPrinting(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('quickReport.title', { defaultValue: 'Quick Report' })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-y-2 text-sm">
            <dt className="font-semibold text-muted-foreground">{t('quickReport.patientName', { defaultValue: 'Patient Name' })}</dt>
            <dd>{formatPatientName(study.patientName)}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.patientId', { defaultValue: 'Patient ID' })}</dt>
            <dd>{study.patientId}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.birthDate', { defaultValue: 'Birth Date' })}</dt>
            <dd>{study.patientBirthDate ? format(study.patientBirthDate, 'PPP') : '—'}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.sex', { defaultValue: 'Sex' })}</dt>
            <dd>{sex}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.studyDate', { defaultValue: 'Study Date' })}</dt>
            <dd>{study.studyDate ? format(study.studyDate, 'PPP') : '—'}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.studyTime', { defaultValue: 'Study Time' })}</dt>
            <dd>{formatMeta(study.studyTime)}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.modality', { defaultValue: 'Modality' })}</dt>
            <dd>{study.modalities.join(', ')}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.studyDescription', { defaultValue: 'Study Description' })}</dt>
            <dd>{formatMeta(study.studyDescription)}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.accessionNumber', { defaultValue: 'Accession Number' })}</dt>
            <dd>{formatMeta(study.accessionNumber)}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.referringPhysician', { defaultValue: 'Referring Physician' })}</dt>
            <dd>{formatMeta(study.referringPhysician?.replace(/\^/g, ', '))}</dd>
            <dt className="font-semibold text-muted-foreground">{t('quickReport.studyInstanceUID', { defaultValue: 'Study Instance UID' })}</dt>
            <dd className="font-mono text-xs break-all">{formatMeta(study.studyInstanceUID)}</dd>
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              {t('quickReport.series', { defaultValue: 'Series' })}
            </h3>
            {seriesLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">{t('common.loading')}</div>
            ) : series.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">{t('quickReport.noSeries', { defaultValue: 'No series data loaded' })}</div>
            ) : isMobile ? (
              /* Mobile: the 4-col table does not fit small viewports —
                 render a readable card list instead. */
              <div className="divide-y border rounded-lg">
                {series.map((s, i) => (
                  <div key={s.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm shrink-0">#{s.seriesNumber ?? i + 1}</span>
                      <ModalityBadge modality={s.modality} />
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {s.numberOfInstances} {t('quickReport.seriesInstances', { defaultValue: 'Instances' })}
                      </span>
                    </div>
                    <p className="text-sm mt-1 break-words">{s.seriesDescription || '—'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{t('quickReport.seriesNumber', { defaultValue: '#' })}</TableHead>
                      <TableHead>{t('studies.modality', { defaultValue: 'Modality' })}</TableHead>
                      <TableHead>{t('quickReport.seriesDescription', { defaultValue: 'Description' })}</TableHead>
                      <TableHead className="w-24">{t('quickReport.seriesInstances', { defaultValue: 'Instances' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {series.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.seriesNumber ?? i + 1}</TableCell>
                        <TableCell>{s.modality}</TableCell>
                        <TableCell>{s.seriesDescription || '—'}</TableCell>
                        <TableCell>{s.numberOfInstances}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={isPrinting} className="gap-1.5">
              {isPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              {t('quickReport.print', { defaultValue: 'Print / Save PDF' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
