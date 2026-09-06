/**
 * sendSeriesAction — audit-seam wrapper for sending a series to a DICOM modality.
 *
 * Side effects:
 *   1. Calls seriesApi.sendToModality(seriesId, modalityId) — POSTs to
 *      /modalities/{name}/store with { Resources: [seriesId] }.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { seriesApi } from '@/api/series';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function sendSeriesAction(
  seriesId: string,
  modalityId: string,
): Promise<void> {
  const base = makeAuditBase('series.send', 'series', seriesId);
  auditClient.emit({ ...base, outcome: 'started', destinationId: modalityId });
  try {
    await seriesApi.sendToModality(seriesId, modalityId);
    auditClient.emit({ ...base, outcome: 'success', destinationId: modalityId });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      destinationId: modalityId,
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
