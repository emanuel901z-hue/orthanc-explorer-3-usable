/**
 * downloadSeriesAction — audit-seam wrapper for downloading a series archive.
 *
 * Side effects:
 *   1. Calls seriesApi.archive(seriesId) to retrieve a ZIP Blob.
 *   2. Triggers a browser file download via a temporary <a> element.
 *   3. Emits an audit event (outcome: success | failure) via auditClient.
 *   4. Always rethrows on failure — callers must handle OrthancError.
 */
import { seriesApi } from '@/api/series';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function downloadSeriesAction(
  seriesId: string,
  filename?: string,
  options?: { dicomDir?: boolean },
): Promise<void> {
  const base = makeAuditBase('series.download', 'series', seriesId);

  try {
    const blob = options?.dicomDir
      ? await seriesApi.media(seriesId)
      : await seriesApi.archive(seriesId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `${seriesId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
