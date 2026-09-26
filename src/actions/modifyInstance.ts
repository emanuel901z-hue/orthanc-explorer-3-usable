/**
 * modifyInstanceAction — audit-seam wrapper for instance tag modification.
 *
 * Side effects:
 *   1. Calls toolsApi.bulkModify({ Resources: [instanceId], Replace }) — the only
 *      Orthanc route that STORES a modified single instance. POST /instances/:id/modify
 *      would answer with the modified DICOM file as a binary download and store nothing.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param instanceId  Orthanc UUID of the instance to modify.
 * @param replace     Object mapping DICOM tag names to new values.
 */
import { toolsApi } from '@/api/tools';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

/** Identifier tags Orthanc refuses to change without Force. */
const FORCE_TAGS = new Set([
  'PatientID',
  'StudyInstanceUID',
  'SeriesInstanceUID',
  'SOPInstanceUID',
]);

export async function modifyInstanceAction(
  instanceId: string,
  replace: Record<string, string>,
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase('instance.modify', 'instance', instanceId);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    const result = await toolsApi.bulkModify({
      Resources: [instanceId],
      Replace: replace,
      Force: Object.keys(replace).some((tag) => FORCE_TAGS.has(tag)),
    });
    const stored = result.Resources?.[0];
    if (!stored || (result.FailedInstancesCount ?? 0) > 0) {
      throw new Error('Orthanc did not store the modified instance.');
    }
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        modifiedTags: Object.keys(replace),
        count: Object.keys(replace).length,
        newInstanceId: stored.ID,
      },
    });
    return { ID: stored.ID, Path: stored.Path };
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
