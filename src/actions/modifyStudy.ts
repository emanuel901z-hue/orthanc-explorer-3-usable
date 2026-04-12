/**
 * modifyStudyAction — audit-seam wrapper for study modification.
 *
 * Side effects:
 *   1. Calls studiesApi.modify(study.ID, body) — creates a modified copy.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param study  The Study object to modify (ID is used for API call and audit).
 * @param body   Modification parameters passed to the Orthanc API.
 */
import { studiesApi, type Study } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

export async function modifyStudyAction(
  study: Study,
  body: Record<string, unknown>,
): Promise<{ ID: string; Path: string }> {
  const base = {
    action: "study.modify",
    resourceType: "study" as const,
    resourceId: study.ID,
    timestamp: new Date().toISOString(),
  };
  try {
    const result = await studiesApi.modify(study.ID, body);
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
