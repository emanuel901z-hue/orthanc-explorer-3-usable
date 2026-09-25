/**
 * exportStudiesAction — audit-seam wrapper for exporting several studies as one
 * ZIP archive (Orthanc POST /tools/create-archive).
 *
 * Side effects:
 *   1. Calls toolsApi.createArchive(studyIds) to retrieve a ZIP Blob.
 *   2. Triggers a browser file download via a temporary <a> element.
 *   3. Emits an audit event (outcome: success | failure) via auditClient.
 *   4. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param studyIds Orthanc UUIDs of the studies to export.
 * @param filename Optional filename (defaults to `studies-<timestamp>.zip`).
 */
import { toolsApi } from '@/api/tools';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function exportStudiesAction(studyIds: string[], filename?: string): Promise<void> {
  const base = makeAuditBase(
    'study.export',
    'study',
    studyIds.length === 1 ? studyIds[0] : `${studyIds.length} studies`,
  );
  try {
    const blob = await toolsApi.createArchive(studyIds);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `studies-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Kurze Verzoegerung, damit der Browser den Speichern-Dialog oeffnen kann
    // (gleiches Muster wie downloadStudyAction).
    await new Promise((resolve) => setTimeout(resolve, 1200));
    URL.revokeObjectURL(url);
    auditClient.emit({ ...base, outcome: 'success', detail: { count: studyIds.length } });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { count: studyIds.length },
    });
    throw e;
  }
}
