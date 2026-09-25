/**
 * queryModalityAction — audit-seam wrapper for DICOM C-FIND against a remote modality.
 */
import { queriesApi, type ModalityQueryParams, type QueryAnswerContent } from '@/api/queries';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export interface RemoteQueryResult {
  queryId: string;
  answers: Array<{
    index: number;
    tags: QueryAnswerContent;
  }>;
}

export async function queryModalityAction(
  modalityName: string,
  params: ModalityQueryParams,
): Promise<RemoteQueryResult> {
  const base = makeAuditBase('modality.query', 'modality', modalityName);
  auditClient.emit({ ...base, outcome: 'started', detail: { query: params.Query } });
  try {
    const queryResource = await queriesApi.queryModality(modalityName, params);
    const answerIndices = await queriesApi.getAnswers(queryResource.ID);

    // Fetch simplified content for each answer in parallel
    const answers = await Promise.all(
      answerIndices.map(async (index) => {
        const tags = await queriesApi.getAnswerContent(queryResource.ID, index);
        return { index, tags };
      }),
    );

    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { queryId: queryResource.ID, count: answers.length },
    });

    return {
      queryId: queryResource.ID,
      answers,
    };
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { query: params.Query },
    });
    throw e;
  }
}
