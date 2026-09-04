/**
 * Typed wrappers for Orthanc job endpoints.
 *
 * Covered:
 *   GET  /jobs              — jobsApi.list()
 *   GET  /jobs?expand=true  — jobsApi.listExpanded()
 *   GET  /jobs/:id          — jobsApi.get()
 *   POST /jobs/:id/cancel   — jobsApi.cancel()
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
  list: () => orthancFetch<string[]>('/jobs'),

  listExpanded: () => orthancFetch<OrthancJob[]>('/jobs?expand=true'),

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
