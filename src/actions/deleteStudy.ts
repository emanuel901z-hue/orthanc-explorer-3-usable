/**
 * deleteStudyAction — audit-seam wrapper for permanent study deletion.
 *
 * Side effects:
 *   1. Calls studiesApi.delete(study.ID) — irreversible.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param study  The Study object to delete (ID is used for API call and audit).
 * @param reason Optional human-readable reason for deletion (threaded to audit).
 */
import { studiesApi, type Study } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function deleteStudyAction(study: Study, reason?: string): Promise<void> {
  const base = { ...makeAuditBase("study.delete", "study", study.ID), reason };
  try {
    await studiesApi.delete(study.ID);
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
