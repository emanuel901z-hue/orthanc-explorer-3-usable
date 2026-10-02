/**
 * deletePeerAction — audit-seam wrapper for removing an Orthanc peer.
 *
 * Removing a peer does not touch any stored image; it only takes the
 * destination out of "send to peer".
 */
import { peersApi } from '@/api/peers';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function deletePeerAction(name: string): Promise<void> {
  const base = makeAuditBase('peer.delete', 'peer', name);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    await peersApi.delete(name);
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
