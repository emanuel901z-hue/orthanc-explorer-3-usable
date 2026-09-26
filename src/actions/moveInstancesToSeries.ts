/**
 * moveInstancesToSeriesAction — audit-seam wrapper for re-attaching instances to
 * another series inside the same study.
 *
 * Orthanc mechanism (verified against Orthanc 1.13):
 *   - POST /instances/:id/modify returns the modified DICOM file as a binary
 *     download and stores nothing — unusable for a server-side move.
 *   - POST /tools/bulk-modify stores the modified copies and accepts
 *     Replace: { SeriesInstanceUID } together with Force: true.
 *   - Orthanc generates a fresh SOPInstanceUID for every stored copy, so no
 *     duplicate SOP Instance UIDs can occur.
 *   - A series that loses its last instance is removed by Orthanc automatically.
 *
 * Cut mode (keepSource=false): the source instances are deleted only AFTER all
 * modified copies were stored. If Orthanc reports FailedInstancesCount > 0, the
 * sources are kept so that no instance can be lost.
 */
import { toolsApi, type OrthancBulkModifyResult } from '@/api/tools';
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export type MoveInstancesToSeriesParams = {
  /** Orthanc IDs of the instances to move. */
  instanceIds: string[];
  /** SeriesInstanceUID of the target series (existing or freshly generated). */
  targetSeriesUid: string;
  /** Extra tag substitutions for the copies (e.g. SeriesNumber/SeriesDescription for a new series). */
  replace?: Record<string, string>;
  /** true = copy, false = cut (delete the source instances after a successful copy). */
  keepSource?: boolean;
};

export type MoveInstancesToSeriesResult = OrthancBulkModifyResult & {
  /** Number of source instances removed in cut mode. */
  deletedCount: number;
  /** Source instance IDs that could not be deleted in cut mode. */
  deleteFailures: string[];
};

export async function moveInstancesToSeriesAction(
  params: MoveInstancesToSeriesParams,
): Promise<MoveInstancesToSeriesResult> {
  const { instanceIds, targetSeriesUid, replace, keepSource = false } = params;
  const base = makeAuditBase('instance.move-series', 'instance', instanceIds[0] ?? '');
  auditClient.emit({
    ...base,
    outcome: 'started',
    detail: {
      instanceCount: instanceIds.length,
      targetSeriesUid,
      keepSource,
      replacedTags: replace ? Object.keys(replace) : undefined,
    },
  });

  try {
    const result = await toolsApi.bulkModify({
      Resources: instanceIds,
      Replace: { SeriesInstanceUID: targetSeriesUid, ...replace },
      Force: true,
    });

    const failedInstances = result.FailedInstancesCount ?? 0;
    let deletedCount = 0;
    const deleteFailures: string[] = [];
    if (!keepSource && failedInstances === 0) {
      for (const id of instanceIds) {
        try {
          await instancesApi.delete(id);
          deletedCount++;
        } catch {
          deleteFailures.push(id);
        }
      }
    }

    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        instanceCount: instanceIds.length,
        targetSeriesUid,
        keepSource,
        storedInstances: result.Resources?.map((r) => r.ID),
        failedInstancesCount: failedInstances,
        deletedCount,
        deleteFailures: deleteFailures.length > 0 ? deleteFailures : undefined,
      },
    });

    return { ...result, deletedCount, deleteFailures };
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { instanceCount: instanceIds.length, targetSeriesUid, keepSource },
    });
    throw e;
  }
}
