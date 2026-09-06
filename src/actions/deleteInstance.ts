/**
 * deleteInstanceAction — audit-seam wrapper for deleting a single instance.
 *
 * Side effects:
 *   1. Calls instancesApi.delete(instanceId) — DELETE /instances/:id.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function deleteInstanceAction(
  instanceId: string,
): Promise<void> {
  const base = makeAuditBase('instance.delete', 'instance', instanceId);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    await instancesApi.delete(instanceId);
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
