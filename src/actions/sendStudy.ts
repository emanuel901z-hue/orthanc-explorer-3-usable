/**
 * sendStudyAction — audit-seam wrapper for sending a study to a DICOM modality.
 *
 * Side effects:
 *   1. Calls studiesApi.sendToModality(studyId, modalityId) — POSTs to
 *      /modalities/{name}/store with { Resources: [studyId] }.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *      Sending a study transfers PHI-bearing data to another system,
 *      so full audit trail is required.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function sendStudyAction(
  studyId: string,
  modalityId: string,
): Promise<void> {
  const base = makeAuditBase('study.send', 'study', studyId);
  try {
    await studiesApi.sendToModality(studyId, modalityId);
    auditClient.emit({ ...base, outcome: 'success', destinationId: modalityId });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      destinationId: modalityId,
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
