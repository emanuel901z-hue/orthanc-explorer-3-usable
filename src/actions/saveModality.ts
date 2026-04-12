/**
 * saveModalityAction — audit-seam wrapper for creating or updating a modality.
 *
 * Side effects:
 *   1. Calls modalitiesApi.put(name, config) — upserts the modality in Orthanc.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { modalitiesApi, type ModalityConfig } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

export async function saveModalityAction(
  name: string,
  config: ModalityConfig,
): Promise<void> {
  const base = {
    action: "modality.save",
    resourceType: "modality" as const,
    resourceId: name,
    timestamp: new Date().toISOString(),
  };
  try {
    await modalitiesApi.put(name, config);
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
