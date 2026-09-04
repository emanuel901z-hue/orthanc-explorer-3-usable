/**
 * Typed wrappers for Orthanc Worklists plugin endpoints.
 *
 * Covered (requires Orthanc Worklists plugin):
 *   GET    /worklists            — worklistsApi.list()
 *   GET    /worklists/:id        — worklistsApi.get()
 *   POST   /worklists/:id/query  — worklistsApi.query()
 *   DELETE /worklists/:id        — worklistsApi.delete()
 *   POST   /worklists            — worklistsApi.create() (if supported)
 */
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type Worklist = {
  ID: string;
  CreationTime: string;
  PatientName?: string;
  PatientID?: string;
  ScheduledProcedureStepSequence?: unknown;
};

export const worklistsApi = {
  /** GET /worklists — Lists all worklist files. */
  list: () => orthancFetch<string[]>('/worklists'),

  /** GET /worklists/:id — Gets worklist details. */
  get: (id: string) => orthancFetch<Worklist>(`/worklists/${id}`),

  /** POST /worklists/:id/query — Queries a worklist (C-FIND with worklist file). */
  query: (id: string, body: Record<string, unknown>) =>
    orthancFetch<unknown[]>(`/worklists/${id}/query`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** DELETE /worklists/:id — Removes a worklist file. */
  delete: (id: string) => orthancFetch<void>(`/worklists/${id}`, { method: 'DELETE' }),

  /** POST /worklists — Uploads a new worklist file (DICOM file). */
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return orthancFetch<{ ID: string }>('/worklists', {
      method: 'POST',
      body: formData,
    });
  },
};
