/**
 * splitStudyAction — audit-seam wrapper for splitting series or instances out of a study.
 *
 * Side effects:
 *   1. Calls studiesApi.split(studyId, params) — creates a new study containing the specified resources.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { studiesApi, type OrthancSplitParams, type OrthancSplitResult } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function splitStudyAction(
  studyId: string,
  params: OrthancSplitParams,
): Promise<OrthancSplitResult> {
  const base = makeAuditBase('study.split', 'study', studyId);
  auditClient.emit({
    ...base,
    outcome: 'started',
    detail: {
      seriesCount: params.Series?.length ?? 0,
      instancesCount: params.Instances?.length ?? 0,
      keepSource: params.KeepSource ?? false,
    },
  });

  try {
    const result = await studiesApi.split(studyId, params);
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        newStudyId: result.TargetStudy,
        newStudyUID: result.TargetStudyUID,
        instancesCount: result.InstancesCount,
        failedInstancesCount: result.FailedInstancesCount,
        keepSource: params.KeepSource ?? false,
      },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: {
        seriesCount: params.Series?.length ?? 0,
        instancesCount: params.Instances?.length ?? 0,
      },
    });
    throw e;
  }
}
