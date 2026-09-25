/**
 * Typed wrappers for Orthanc job endpoints.
 *
 * Covered:
 *   GET  /jobs              — jobsApi.list()
 *   GET  /jobs?expand=true  — jobsApi.listExpanded()
 *   GET  /jobs/:id          — jobsApi.get()
 *   POST /jobs/:id/cancel   — jobsApi.cancel()
 *   POST /jobs/:id/pause    — jobsApi.pause()
 *   POST /jobs/:id/resume   — jobsApi.resume()
 *   POST /jobs/:id/resubmit — jobsApi.resubmit()
 *
 * Response shapes:
 *   GET /jobs                     -> string[] (job IDs only, no state)
 *   GET /jobs?expand=true         -> OrthancJob[] (state, progress, timings)
 *   GET /jobs/:id                 -> OrthancJob (single job, 404 if unknown)
 *   POST /jobs/:id/{cancel,pause,resume,resubmit}
 *                                 -> Orthanc job resource (200) bzw.
 *                                    { HttpError } bei ungueltigem Zustand
 */
// src/api/jobs.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type OrthancJobState = 'Pending' | 'Running' | 'Success' | 'Failure' | 'Paused' | 'Retry';

export type OrthancJob = {
  ID: string;
  Type: string;
  State: OrthancJobState;
  Progress: number;
  CreationTime: string;
  CompletionTime?: string;
  ErrorMessage?: string;
  Content?: Record<string, unknown>;
  EffectiveLastUpdate?: string;
  EffectiveRuntime?: number;
  ErrorCode?: number;
  ErrorDescription?: string;
  ErrorDetails?: string;
  Priority?: number;
  Timestamp?: string;
};

export const jobsApi = {
  // GET /jobs — nur Job-IDs (string[]), keine States. Fuer Status die
  // expandierte Variante nutzen.
  list: () => orthancFetch<string[]>('/jobs'),

  // GET /jobs?expand=true — Query-Parameter expand liefert volle Job-Objekte
  // (State, Progress, CreationTime, ErrorMessage) statt nur IDs.
  listExpanded: () => orthancFetch<OrthancJob[]>('/jobs?expand=true'),

  // GET /jobs/:id — einzelner Job; Orthanc antwortet 404/HttpError, wenn die ID
  // nicht (mehr) existiert.
  get: (id: string) => orthancFetch<OrthancJob>(`/jobs/${id}`),

  cancel: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/jobs/${id}/cancel`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),

  pause: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/jobs/${id}/pause`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),

  resume: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/jobs/${id}/resume`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),

  resubmit: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/jobs/${id}/resubmit`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),
};
