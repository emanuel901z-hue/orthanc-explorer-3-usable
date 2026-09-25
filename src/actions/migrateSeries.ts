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
  seriesId: string,
  keepSource = false,
): Promise<OrthancMergeResult> {
  const base = makeAuditBase('series.migrate', 'series', seriesId);
  auditClient.emit({ ...base, outcome: 'started', detail: { targetStudyId, keepSource } });
  try {
    const result = await studiesApi.merge(targetStudyId, [seriesId], keepSource);
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        targetStudyId,
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
      detail: { targetStudyId, keepSource },
    });
    throw e;
  }
}
