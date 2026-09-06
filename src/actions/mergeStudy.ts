/**
 * mergeStudyAction — audit-seam wrapper for study merge (migration).
 *
 * Side effects:
 *   1. Calls studiesApi.merge(targetId, sourceIds, keepSource) — merges sources into target.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param targetId   Orthanc UUID of the target study (receives merged series).
 * @param sourceIds  Array of Orthanc UUIDs of source studies to merge into target.
 * @param keepSource If false, source studies are deleted after merge.
 */
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function mergeStudyAction(
  targetId: string,
  sourceIds: string[],
  keepSource = false,
): Promise<{ TargetStudy: string; MergedStudies: string[] }> {
  const base = makeAuditBase("study.merge", "study", targetId);
  auditClient.emit({ ...base, outcome: "started", detail: { sourceIds, keepSource } });
  try {
    const result = await studiesApi.merge(targetId, sourceIds, keepSource);
    auditClient.emit({
      ...base,
      outcome: "success",
      detail: {
        sourceIds,
        keepSource,
        mergedCount: sourceIds.length,
      },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: "failure",
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { sourceIds, keepSource },
    });
    throw e;
  }
}
