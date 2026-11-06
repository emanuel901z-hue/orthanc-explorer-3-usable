/**
 * moveResourcesAction — Audit-Seam für einen C-MOVE auf Studien- oder
 * Serien-Ebene (ein Auftrag, mehrere Ressourcen).
 */
import { queriesApi } from '@/api/queries';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function moveResourcesAction(
  modalityName: string,
  level: 'Study' | 'Series',
  resources: Record<string, string>[],
  options: { targetAet?: string; asynchronous?: boolean } = {},
): Promise<Record<string, unknown>> {
  const base = makeAuditBase('modality.retrieve', 'modality', modalityName);
  if (options.targetAet) base.destinationId = options.targetAet;
  auditClient.emit({
    ...base,
    outcome: 'started',
    detail: { level, count: resources.length, targetAet: options.targetAet },
  });
  try {
    const result = await queriesApi.moveResources(modalityName, level, resources, options);
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { level, count: resources.length, jobId: result.ID },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { level, count: resources.length },
    });
    throw e;
  }
}
