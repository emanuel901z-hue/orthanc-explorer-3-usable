/**
 * migrateSeriesAction — audit-seam wrapper for migrating a series into a study.
 *
 * Side effects:
 *   1. Calls studiesApi.merge(targetStudyId, [seriesId], keepSource).
 *   2. Emits an audit event (outcome: started | success | warning | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { studiesApi, type OrthancMergeResult } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function migrateSeriesAction(
  targetStudyId: string,
  seriesIds: string | string[],
  keepSource = false,
): Promise<OrthancMergeResult> {
  const ids = Array.isArray(seriesIds) ? seriesIds : [seriesIds];
  const primaryId = ids[0] ?? targetStudyId;
  const base = makeAuditBase('series.migrate', 'series', primaryId);
  auditClient.emit({
    ...base,
    outcome: 'started',
    detail: { targetStudyId, seriesIds: ids, count: ids.length, keepSource },
  });
  try {
    const result = await studiesApi.merge(targetStudyId, ids, keepSource);
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        targetStudyId,
        seriesIds: ids,
        count: ids.length,
        keepSource,
        instancesCount: result.InstancesCount,
        failedInstancesCount: result.FailedInstancesCount,
      },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { targetStudyId, seriesIds: ids, count: ids.length, keepSource },
    });
    throw e;
  }
}
