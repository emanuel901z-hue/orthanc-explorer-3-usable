/**
 * Typed wrappers for Orthanc DICOM C-FIND and C-MOVE Query/Retrieve endpoints.
 *
 * Orthanc Q/R flow:
 *   1. POST /modalities/:name/query          -> queriesApi.queryModality() -> { ID, Path }
 *   2. GET  /queries/:id/answers             -> queriesApi.getAnswers() -> number[] (e.g. [0, 1, 2])
 *   3. GET  /queries/:id/answers/:i/content  -> queriesApi.getAnswerContent() -> simplified DICOM tags
 *   4. POST /queries/:id/answers/:i/retrieve -> queriesApi.retrieveAnswer() -> initiates C-MOVE job
 *   5. DELETE /queries/:id                   -> queriesApi.delete() -> removes temporary query resource
 */
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type QueryLevel = 'Patient' | 'Study' | 'Series' | 'Instance';

export type ModalityQueryParams = {
  Level?: QueryLevel;
  Query: Record<string, string>;
  Normalize?: boolean;
};

export type QueryResource = {
  ID: string;
  Path: string;
};

export type QueryAnswerContent = Record<string, string>;

export const queriesApi = {
  /** POST /modalities/:name/query — Starts a C-FIND query against a remote DICOM modality. */
  queryModality: (modalityName: string, params: ModalityQueryParams) =>
    orthancFetch<QueryResource>(`/modalities/${encodeURIComponent(modalityName)}/query`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ Level: 'Study', ...params }),
    }),

  /** GET /queries/:id/answers — Returns the list of answer indices (e.g. [0, 1, 2]). */
  getAnswers: (queryId: string) =>
    orthancFetch<number[]>(`/queries/${queryId}/answers`),

  /** GET /queries/:id/answers/:index/content?simplify — Returns simplified tags for a specific answer. */
  getAnswerContent: (queryId: string, answerIndex: number) =>
    orthancFetch<QueryAnswerContent>(`/queries/${queryId}/answers/${answerIndex}/content?simplify`),

  /** POST /queries/:id/answers/:index/retrieve — Initiates C-MOVE to retrieve the answer into Orthanc. */
  retrieveAnswer: (queryId: string, answerIndex: number, targetAet?: string) =>
    orthancFetch<Record<string, unknown>>(`/queries/${queryId}/answers/${answerIndex}/retrieve`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: targetAet ? JSON.stringify(targetAet) : JSON.stringify(''),
    }),

  /** DELETE /queries/:id — Removes the temporary query resource from Orthanc memory. */
  delete: (queryId: string) =>
    orthancFetch<void>(`/queries/${queryId}`, { method: 'DELETE' }),
};
