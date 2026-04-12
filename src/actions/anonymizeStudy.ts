/**
 * anonymizeStudyAction — audit-seam wrapper for study anonymization.
 *
 * Side effects:
 *   1. Calls studiesApi.anonymize(study.ID, body) — creates a new anonymized copy.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param study  The Study object to anonymize (ID is used for API call and audit).
 * @param body   Optional anonymization parameters passed to the Orthanc API.
 */
import { studiesApi, type Study } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function anonymizeStudyAction(
  study: Study,
  body: Record<string, unknown> = {},
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase("study.anonymize", "study", study.ID);
  try {
    const result = await studiesApi.anonymize(study.ID, body);
    auditClient.emit({ ...base, outcome: "success" });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: "failure",
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
