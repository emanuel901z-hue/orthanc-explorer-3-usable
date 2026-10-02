/**
 * savePeerAction — audit-seam wrapper for creating or updating an Orthanc peer.
 *
 * Peers are what "send to peer" transfers to; without a way to create one the
 * button in the study detail leads into an empty dialog, so this is the write
 * path behind the settings tab.
 */
import { peersApi, type PeerConfig } from '@/api/peers';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function savePeerAction(
  name: string,
  config: PeerConfig,
  created: boolean,
): Promise<void> {
  const base = makeAuditBase(created ? 'peer.create' : 'peer.update', 'peer', name);
  // the credentials never go into the audit trail — only whether they were set
  const detail = { url: config.Url, credentials: Boolean(config.Username) };
  auditClient.emit({ ...base, outcome: 'started', detail });
  try {
    await peersApi.put(name, config);
    auditClient.emit({ ...base, outcome: 'success', detail });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail,
    });
    throw e;
  }
}
