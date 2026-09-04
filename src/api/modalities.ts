/**
 * Typed wrappers for Orthanc DICOM modality endpoints.
 *
 * Covered:
 *   GET    /modalities              — modalitiesApi.list()
 *   GET    /modalities/:name        — modalitiesApi.get()
 *   PUT    /modalities/:name        — modalitiesApi.put()
 *   DELETE /modalities/:name        — modalitiesApi.delete()
 *   POST   /modalities/:name/echo   — modalitiesApi.echo()
 */
// src/api/modalities.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type ModalityConfig = {
  AET: string;
  Host: string;
  Port: number;
  Manufacturer?: string;
};

export const modalitiesApi = {
  /** GET /modalities — Returns array of modality names (string[]). */
  list: () => orthancFetch<string[]>('/modalities'),

  /** GET /modalities/:name/configuration — Returns ModalityConfig (AET, Host, Port). */
  get: (name: string) => orthancFetch<ModalityConfig>(`/modalities/${name}/configuration`),

  /** PUT /modalities/:name — Creates or updates a modality. Body: ModalityConfig. Returns 200 (void). */
  put: (name: string, body: ModalityConfig) =>
    orthancFetch<void>(`/modalities/${name}`, {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** DELETE /modalities/:name — Removes a modality. Returns 200 (void). */
  delete: (name: string) => orthancFetch<void>(`/modalities/${name}`, { method: 'DELETE' }),

  /** POST /modalities/:name/echo — Sends DICOM C-ECHO. Returns response details. */
  echo: (name: string) =>
    orthancFetch<Record<string, unknown>>(`/modalities/${name}/echo`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),

  /** POST /modalities/:name/query — DICOM C-FIND query. Body: { Level, Query }. Returns array of answers. */
  query: (name: string, body: { Level: string; Query: Record<string, string> }) =>
    orthancFetch<unknown[]>(`/modalities/${name}/query`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** POST /modalities/:name/query/:id/retrieve — C-MOVE/C-GET retrieve for a query answer. */
  retrieve: (name: string, queryId: string) =>
    orthancFetch<Record<string, unknown>>(`/modalities/${name}/query/${queryId}/retrieve`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({}),
    }),

  /** DELETE /modalities/:name/query/:id — Remove a query and its answers. */
  deleteQuery: (name: string, queryId: string) =>
    orthancFetch<void>(`/modalities/${name}/query/${queryId}`, { method: 'DELETE' }),
};
