/**
 * downloadInstanceAction — audit-seam wrapper for downloading an instance DICOM file.
 *
 * Side effects:
 *   1. Calls instancesApi.archive(instanceId) to retrieve a DICOM Blob.
 *   2. Triggers a browser file download via a temporary <a> element.
 *   3. Emits an audit event (outcome: success | failure) via auditClient.
 *   4. Always rethrows on failure — callers must handle OrthancError.
 */
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function downloadInstanceAction(
  instanceId: string,
  filename?: string,
  options?: { nifti?: boolean },
): Promise<void> {
  const base = makeAuditBase('instance.download', 'instance', instanceId);

  try {
    const blob = options?.nifti
      ? await instancesApi.nifti(instanceId)
      : await instancesApi.archive(instanceId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? (options?.nifti ? `${instanceId}.nii` : `${instanceId}.dcm`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
