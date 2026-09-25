import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { instancesApi } from '@/api/instances';
import type { DicomTag } from '@/shared/types';

interface InstanceDocumentViewerProps {
  instanceId: string;
  sopClassUID?: string;
  tags: DicomTag[];
}

export const SOP_CLASS_ENCAPSULATED_PDF = '1.2.840.10008.5.1.4.1.1.104.1';

export function isEncapsulatedPdf(sopClassUID?: string): boolean {
  return sopClassUID === SOP_CLASS_ENCAPSULATED_PDF;
}

export function isStructuredReport(sopClassUID?: string): boolean {
  return !!sopClassUID && sopClassUID.startsWith('1.2.840.10008.5.1.4.1.1.88.');
}

function findTag(tags: DicomTag[], name: string): string | undefined {
  return tags.find((t) => t.name === name)?.value || undefined;
}

export function InstanceDocumentViewer({ instanceId, sopClassUID, tags }: InstanceDocumentViewerProps) {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdf = isEncapsulatedPdf(sopClassUID);
  const isSr = isStructuredReport(sopClassUID);

  useEffect(() => {
    if (!isPdf) return;
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);

    instancesApi.getPdf(instanceId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [instanceId, isPdf]);

  // 1. PDF Viewer
  if (isPdf) {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-b-lg">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p className="text-xs">{t('instance.loadingPdf', { defaultValue: 'Loading PDF document…' })}</p>
        </div>
      );
    }

    if (error || !pdfUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-destructive bg-destructive/5 rounded-b-lg p-4 text-center">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">{t('instance.pdfError', { defaultValue: 'Could not load PDF document' })}</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col bg-muted/10 rounded-b-lg overflow-hidden">
        {/* PDF Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b text-xs">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium">{t('instance.pdfDocument', { defaultValue: 'PDF Document' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => window.open(pdfUrl, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              {t('instance.openNewTab', { defaultValue: 'Open in new tab' })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.download = `document-${instanceId}.pdf`;
                a.click();
              }}
            >
              <Download className="h-3 w-3" />
              {t('instance.downloadPdf', { defaultValue: 'Download PDF' })}
            </Button>
          </div>
        </div>

        {/* Embedded Iframe */}
        <iframe
          src={pdfUrl}
          className="w-full h-[650px] border-0 bg-background"
          title="Encapsulated PDF Document"
        />
      </div>
    );
  }

  // 2. Structured Report Viewer
  if (isSr) {
    const docTitle = findTag(tags, 'DocumentTitle') || findTag(tags, 'SeriesDescription') || 'DICOM Structured Report';
    const completion = findTag(tags, 'CompletionFlag');
    const verification = findTag(tags, 'VerificationFlag');
    const observationDate = findTag(tags, 'ObservationDateTime') || findTag(tags, 'ContentDate');
    const textValues = tags.filter((t) => t.name.includes('Text') || t.name === 'TextValue');

    return (
      <div className="p-4 bg-muted/10 rounded-b-lg space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-3 gap-2">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {docTitle}
            </h3>
            {observationDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('instance.observationDate', { defaultValue: 'Observation Date' })}: {observationDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {completion && (
              <Badge variant="outline" className="text-xs">
                {completion}
              </Badge>
            )}
            {verification && (
              <Badge variant={verification === 'VERIFIED' ? 'default' : 'secondary'} className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {verification}
              </Badge>
            )}
          </div>
        </div>

        {/* Report Content */}
        {textValues.length > 0 ? (
          <div className="space-y-2">
            {textValues.map((tv, idx) => (
              <div key={idx} className="rounded border bg-background p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {tv.value}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border bg-background p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{t('instance.srSummary', { defaultValue: 'Structured Report Summary' })}</p>
            <p>{t('instance.srCheckTagsHint', { defaultValue: 'Structured report attributes and coded sequences are listed in the DICOM tags table below.' })}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
