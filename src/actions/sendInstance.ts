/**
 * sendInstanceAction — audit-seam wrapper for sending an instance to a DICOM modality.
 *
 * Side effects:
 *   1. Calls instancesApi.sendToModality(instanceId, modalityId) — POSTs to
 *      /modalities/{name}/store with { Resources: [instanceId] }.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function sendInstanceAction(
  instanceId: string,
  modalityId: string,
): Promise<void> {
  const base = makeAuditBase('instance.send', 'instance', instanceId);
  try {
    await instancesApi.sendToModality(instanceId, modalityId);
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
