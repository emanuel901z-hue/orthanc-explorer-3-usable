/**
 * deleteModalityAction — audit-seam wrapper for removing a DICOM modality.
 *
 * Side effects:
 *   1. Calls modalitiesApi.delete(name) — removes the modality from Orthanc.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { modalitiesApi } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function deleteModalityAction(name: string): Promise<void> {
  const base = makeAuditBase('modality.delete', 'modality', name);
  auditClient.emit({ ...base, outcome: "started" });
  try {
    await modalitiesApi.delete(name);
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
