/**
 * modifyInstanceAction — audit-seam wrapper for instance tag modification.
 *
 * Side effects:
 *   1. Calls instancesApi.modify(instanceId, body) — POST /instances/:id/modify
 *      with { Replace: { ...tags } }.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param instanceId  Orthanc UUID of the instance to modify.
 * @param replace     Object mapping DICOM tag names to new values.
 */
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function modifyInstanceAction(
  instanceId: string,
  replace: Record<string, string>,
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase('instance.modify', 'instance', instanceId);
  try {
    const result = await instancesApi.modify(instanceId, { Replace: replace });
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { modifiedTags: Object.keys(replace), count: Object.keys(replace).length },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { modifiedTags: Object.keys(replace) },
    });
    throw e;
  }
}
