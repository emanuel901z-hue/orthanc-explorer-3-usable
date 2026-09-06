/**
 * modifySeriesAction — audit-seam wrapper for series tag modification.
 *
 * Side effects:
 *   1. Calls seriesApi.modify(seriesId, body) — POSTs to /series/:id/modify
 *      with { Replace: { ...tags } }.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param seriesId  Orthanc UUID of the series to modify.
 * @param replace   Object mapping DICOM tag names to new values (e.g. { SeriesDescription: "CT Chest" }).
 */
import { seriesApi } from '@/api/series';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function modifySeriesAction(
  seriesId: string,
  replace: Record<string, string>,
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase('series.modify', 'series', seriesId);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    const result = await seriesApi.modify(seriesId, { Replace: replace });
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { modifiedTags: Object.keys(replace), count: Object.keys(replace).length },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { modifiedTags: Object.keys(replace) },
    });
    throw e;
  }
}
