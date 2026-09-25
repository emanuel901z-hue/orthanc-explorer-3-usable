/**
 * sendToPeerAction — audit-seam wrapper for sending resources to an Orthanc peer.
 */
import { peersApi } from '@/api/peers';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function sendToPeerAction(
  peerName: string,
  resourceId: string,
  resourceType: 'study' | 'series' | 'instance' = 'study',
): Promise<Record<string, unknown>> {
  const base = makeAuditBase('peer.send', 'peer', peerName);
  auditClient.emit({
    ...base,
    outcome: 'started',
    detail: { resourceId, resourceType },
  });
  try {
    const result = await peersApi.send(peerName, resourceId);
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { resourceId, resourceType },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { resourceId, resourceType },
    });
    throw e;
  }
}
