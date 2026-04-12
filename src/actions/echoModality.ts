/**
 * echoModalityAction — audit-seam wrapper for sending a C-ECHO to a modality.
 *
 * Side effects:
 *   1. Calls modalitiesApi.echo(name) — triggers Orthanc to send DICOM C-ECHO.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *      Echo is logged even though it's read-like: it confirms reachability of
 *      a system that may hold PHI, so operational audit trail is warranted.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * Returns the raw echo response so callers can surface connection details.
 */
import { modalitiesApi } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function echoModalityAction(
  name: string,
): Promise<Record<string, unknown>> {
  const base = makeAuditBase('modality.echo', 'modality', name);
  try {
    const result = await modalitiesApi.echo(name);
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
