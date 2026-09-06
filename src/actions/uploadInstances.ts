/**
 * uploadInstancesAction — audit-seam wrapper for DICOM instance uploads.
 *
 * Side effects:
 *   1. Calls instancesApi.upload(file) for each file sequentially.
 *   2. Emits one audit event per file (outcome: success | failure) via auditClient.
 *   3. Does NOT rethrow individual upload failures — returns aggregate counts.
 *
 * Audit / PHI note:
 *   DICOM filenames can carry patient identifiers (name, MRN, DOB). The audit
 *   `resourceId` therefore MUST NOT be the user-supplied filename — a non-PHI
 *   batch id is used for the "started" event and the Orthanc-assigned instance
 *   UUID (`result.ID`) is used for the "success" event. Filenames are never
 *   logged. The correlation between batch id and Orthanc UUID is preserved via
 *   the `detail.batchId` field (server-side only, never client-logged).
 *
 * @param files  Array of File objects to upload.
 * @returns      { succeeded, failed } counts.
 */
import { instancesApi } from "@/api/instances";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";
import { newCorrelationId } from "@/lib/correlation";

export async function uploadInstancesAction(
  files: File[],
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (const file of files) {
    // Non-PHI batch id — used as resourceId for the "started" event and as the
    // audit correlation key. The Orthanc instance UUID is only known AFTER the
    // upload succeeds, so it is used in the success event only.
    const batchId = `upload-${newCorrelationId()}`;
    const base = makeAuditBase("instance.upload", "instance", batchId);
    auditClient.emit({ ...base, outcome: "started" });
    try {
      const result = await instancesApi.upload(file);
      auditClient.emit({
        // Override resourceId with the real Orthanc UUID now that it is known.
        ...base,
        resourceId: result.ID,
        outcome: "success",
        detail: { batchId },
      });
      succeeded += 1;
    } catch (e) {
      auditClient.emit({
        ...base,
        outcome: "failure",
        errorCode: e instanceof OrthancError ? e.status : undefined,
      });
      failed += 1;
    }
  }

  return { succeeded, failed };
}
