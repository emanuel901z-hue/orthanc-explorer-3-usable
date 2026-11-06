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

  /** POST /queries/:id/answers/:index/retrieve — Initiates C-MOVE to retrieve the answer into Orthanc.
   *
   * Without a target AET the study comes into this Orthanc. With a target AET
   * the queried archive delivers it straight to that destination — Orthanc
   * only accepts that as an object payload; the legacy plain-string form ends
   * in "Internal error" (verified against Orthanc 1.13).
   *
   * `asynchronous` returns a job resource (`{ ID }`) instead of blocking the
   * HTTP request until the archive has pushed every instance — that is what
   * large studies need, and the job is where the progress lives. */
  retrieveAnswer: (
    queryId: string,
    answerIndex: number,
    targetAet?: string,
    options: { asynchronous?: boolean; timeoutSeconds?: number } = {},
  ) =>
    orthancFetch<Record<string, unknown>>(`/queries/${queryId}/answers/${answerIndex}/retrieve`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      // Der reine Abruf in den lokalen Orthanc bleibt beim leeren String —
      // nur ein Ziel oder ein Job braucht den Objekt-Body.
      body:
        !targetAet && options.asynchronous !== true
          ? JSON.stringify('')
          : JSON.stringify({
            ...(targetAet ? { TargetAet: targetAet } : {}),
            Timeout: options.timeoutSeconds ?? 300,
            Asynchronous: options.asynchronous === true,
          }),
    }),

  /** DELETE /queries/:id — Removes the temporary query resource from Orthanc memory. */
  delete: (queryId: string) =>
    orthancFetch<void>(`/queries/${queryId}`, { method: 'DELETE' }),
};
