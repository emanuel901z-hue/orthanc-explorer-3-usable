/**
 * sendStudyAction — audit-seam wrapper for pushing a study to a modality or peer.
 *
 * Side effects:
 *   1. POSTs [studyId] to /modalities/{target}/store or /peers/{target}/store.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param studyId     The Orthanc study ID to send.
 * @param targetKind  Whether to send to a "modality" or a "peer".
 * @param targetName  Name of the modality AET or peer identifier.
 */
import { orthancFetch } from "@/lib/client";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

export async function sendStudyAction(
  studyId: string,
  targetKind: "modality" | "peer",
  targetName: string,
): Promise<void> {
  const safeName = encodeURIComponent(targetName);
  const path =
    targetKind === "modality"
      ? `/modalities/${safeName}/store`
      : `/peers/${safeName}/store`;

  const base = {
    action: "study.send",
    resourceType: "study" as const,
    resourceId: studyId,
    timestamp: new Date().toISOString(),
  };

  try {
    await orthancFetch<unknown>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([studyId]),
    });
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
