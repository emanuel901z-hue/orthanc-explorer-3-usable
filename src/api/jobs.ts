/**
 * Typed wrappers for Orthanc job endpoints.
 *
 * Covered:
 *   GET  /jobs          — jobsApi.list()
 *   GET  /jobs/:id      — jobsApi.get()
 *   POST /jobs/:id/cancel — jobsApi.cancel()
 */
// src/api/jobs.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type Job = {
  ID: string;
  Type: string;
  State: 'Pending' | 'Running' | 'Success' | 'Failure' | 'Paused' | 'Retry';
  Progress: number;
  CreationTime: string;
  CompletionTime?: string;
  ErrorMessage?: string;
};

export const jobsApi = {
  list: () => orthancFetch<string[]>('/jobs'),

  get: (id: string) => orthancFetch<Job>(`/jobs/${id}`),

  cancel: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/jobs/${id}/cancel`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),
};
