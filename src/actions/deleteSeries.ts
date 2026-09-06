/**
 * deleteSeriesAction — audit-seam wrapper for permanent series deletion.
 *
 * Side effects:
 *   1. Calls seriesApi.delete(seriesId) — irreversible.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { seriesApi } from '@/api/series';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function deleteSeriesAction(seriesId: string, reason?: string): Promise<void> {
  const base = { ...makeAuditBase('series.delete', 'series', seriesId), reason };
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    await seriesApi.delete(seriesId);
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
