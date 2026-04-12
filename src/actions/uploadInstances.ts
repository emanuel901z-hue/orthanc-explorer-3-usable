/**
 * uploadInstancesAction — audit-seam wrapper for DICOM instance uploads.
 *
 * Side effects:
 *   1. Calls instancesApi.upload(file) for each file sequentially.
 *   2. Emits one audit event per file (outcome: success | failure) via auditClient.
 *   3. Does NOT rethrow individual upload failures — returns aggregate counts.
 *
 * @param files  Array of File objects to upload.
 * @returns      { succeeded, failed } counts.
 */
import { instancesApi } from "@/api/instances";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function uploadInstancesAction(
  files: File[],
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (const file of files) {
    const base = makeAuditBase("instance.upload", "instance", file.name);
    try {
      await instancesApi.upload(file);
      auditClient.emit({ ...base, outcome: "success" });
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
