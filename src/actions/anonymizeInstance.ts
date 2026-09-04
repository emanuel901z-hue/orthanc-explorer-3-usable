/**
 * anonymizeInstanceAction — audit-seam wrapper for instance anonymization.
 *
 * Side effects:
 *   1. Calls instancesApi.anonymize(instanceId, body) — POST /instances/:id/anonymize.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param instanceId  Orthanc UUID of the instance to anonymize.
 * @param body        Anonymization parameters ({ Remove, Replace, Keep }).
 */
import { instancesApi } from "@/api/instances";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function anonymizeInstanceAction(
  instanceId: string,
  body: Record<string, unknown> = {},
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase("instance.anonymize", "instance", instanceId);
  try {
    const result = await instancesApi.anonymize(instanceId, body);
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
