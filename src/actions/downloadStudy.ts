/**
 * downloadStudyAction — audit-seam wrapper for downloading a study archive.
 *
 * Side effects:
 *   1. Calls studiesApi.archive(studyId) to retrieve a ZIP Blob.
 *   2. Triggers a browser file download via a temporary <a> element.
 *   3. Emits an audit event (outcome: success | failure) via auditClient.
 *   4. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param studyId   The Orthanc study ID to download.
 * @param filename  Optional filename for the downloaded file (defaults to `{studyId}.zip`).
 */
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

export async function downloadStudyAction(studyId: string, filename?: string): Promise<void> {
  const base = {
    action: "study.download",
    resourceType: "study" as const,
    resourceId: studyId,
    timestamp: new Date().toISOString(),
  };

  try {
    const blob = await studiesApi.archive(studyId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `${studyId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
