/**
 * retrieveModalityAction — audit-seam wrapper for DICOM C-MOVE retrieve into Orthanc.
 */
import { queriesApi } from '@/api/queries';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function retrieveModalityAction(
  modalityName: string,
  queryId: string,
  answerIndex: number,
  targetAet?: string,
): Promise<Record<string, unknown>> {
  const base = makeAuditBase('modality.retrieve', 'modality', modalityName);
  auditClient.emit({
    ...base,
    outcome: 'started',
    detail: { queryId, answerIndex, targetAet },
  });
  try {
    const result = await queriesApi.retrieveAnswer(queryId, answerIndex, targetAet);
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { queryId, answerIndex },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { queryId, answerIndex },
    });
    throw e;
  }
}
