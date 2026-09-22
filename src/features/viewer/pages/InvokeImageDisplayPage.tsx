import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { RepositoryFactory } from '@/shared/api/repository-factory';
import { requestViewerSession } from '@/lib/viewer-session';
import { buildViewerUrl, limitToMostRecent, parseIidRequest } from '@/features/viewer/lib/iid';
import { imageDisplayUrl } from '@/features/viewer/lib/viewer-config';

/** Newest first — IID's `mostRecentResults` counts from the newest study. */
function newestFirst<T extends { studyDate?: Date }>(studies: T[]): T[] {
  return [...studies].sort(
    (a, b) => (b.studyDate?.getTime() ?? 0) - (a.studyDate?.getTime() ?? 0),
  );
}

/**
 * IHE "Invoke Image Display" (RAD-106) — the entry point a RIS/KIS calls.
 *
 * `/IHEInvokeImageDisplay?requestType=STUDY&studyUID=…` (or `accessionNumber=…`)
 * and `?requestType=PATIENT&patientID=…`. The study UIDs that are not given
 * outright are looked up in the PACS first; then the viewer opens. Nothing is
 * displayed here — this page is a translator, not a viewer.
 */
export default function InvokeImageDisplayPage() {
  const { search } = useLocation();
  const { t } = useTranslation();
  const request = useMemo(() => parseIidRequest(search), [search]);

  // A study UID is already the answer; an accession number or a patient ID has
  // to be resolved against the PACS before a viewer can be opened.
  const needsLookup = !request.error
    && (request.requestType === 'PATIENT'
      || (request.requestType === 'STUDY' && request.accessionNumbers.length > 0));

  const lookup = useQuery({
    queryKey: ['iid-lookup', request.requestType, request.patientID,
      request.accessionNumbers.join(','), request.studyUIDs.join(',')],
    enabled: needsLookup,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const repository = RepositoryFactory.createStudyRepository();

      if (request.requestType === 'PATIENT') {
        const studies = await repository.findAll({ patientId: request.patientID });
        return limitToMostRecent(newestFirst(studies), request.mostRecentResults)
          .map((study) => study.studyInstanceUID)
          .filter(Boolean);
      }

      const found: string[] = [];
      for (const accession of request.accessionNumbers) {
        const studies = await repository.findAll({ accessionNumber: accession });
        for (const study of studies) {
          if (study.studyInstanceUID) found.push(study.studyInstanceUID);
        }
      }
      return found;
    },
  });

  // An invalid request is never acted on — even if it happens to carry a
  // usable study UID next to the mistake.
  const studyUIDs = !request.error && request.requestType === 'STUDY' && request.studyUIDs.length
    ? request.studyUIDs
    : (lookup.data ?? []);
  const target = studyUIDs.length ? buildViewerUrl(imageDisplayUrl(), studyUIDs) : '';

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    // The DICOMweb cookie first (a no-op in standalone deployments), then the
    // viewer — same order the "Open in OHIF" button uses.
    void requestViewerSession().then(() => {
      if (!cancelled) window.location.replace(target);
    });
    return () => { cancelled = true; };
  }, [target]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-xl">
        <CardContent className="pt-6 space-y-3">
          <h1 className="text-lg font-semibold">{t('iid.title')}</h1>

          {request.error ? (
            <>
              <p role="alert" className="text-sm text-destructive">
                {t(`iid.err_${request.error}`)}
              </p>
              <p className="text-xs text-muted-foreground">{t('iid.hint')}</p>
            </>
          ) : lookup.isError ? (
            <p role="alert" className="text-sm text-destructive">{t('iid.failed')}</p>
          ) : needsLookup && lookup.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('iid.resolving')}
            </p>
          ) : !studyUIDs.length ? (
            <p role="alert" className="text-sm text-destructive">{t('iid.notFound')}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('iid.redirecting')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
