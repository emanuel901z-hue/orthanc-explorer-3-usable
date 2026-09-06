/**
 * anonymizeStudyAction — audit-seam wrapper for study anonymization.
 *
 * Side effects:
 *   1. Calls studiesApi.anonymize(studyId, body) — creates a new anonymized copy.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param studyId  Orthanc UUID of the study to anonymize.
 * @param body     Optional anonymization parameters passed to the Orthanc API.
 */
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function anonymizeStudyAction(
  studyId: string,
  body: Record<string, unknown> = {},
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase("study.anonymize", "study", studyId);
  auditClient.emit({ ...base, outcome: "started" });
  try {
    const result = await studiesApi.anonymize(studyId, body);
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
