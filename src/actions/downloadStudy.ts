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
 * @param options   Optional: { dicomDir?: boolean } — if true, downloads with DICOMDIR index.
 */
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function downloadStudyAction(
  studyId: string,
  filename?: string,
  options?: { dicomDir?: boolean },
): Promise<void> {
  const base = makeAuditBase("study.download", "study", studyId);

  try {
    const blob = options?.dicomDir
      ? await studiesApi.media(studyId)
      : await studiesApi.archive(studyId);
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
