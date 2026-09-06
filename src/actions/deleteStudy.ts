/**
 * deleteStudyAction — audit-seam wrapper for permanent study deletion.
 *
 * Side effects:
 *   1. Calls studiesApi.delete(studyId) — irreversible.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param studyId  Orthanc UUID of the study to delete (used for API call and audit).
 * @param reason   Optional human-readable reason for deletion (passed to audit,
 *                 never client-logged — may carry PHI).
 */
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function deleteStudyAction(studyId: string, reason?: string): Promise<void> {
  const base = { ...makeAuditBase("study.delete", "study", studyId), reason };
  auditClient.emit({ ...base, outcome: "started" });
  try {
    await studiesApi.delete(studyId);
    auditClient.emit({ ...base, outcome: "success" });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: "failure",
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
