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
import { orthancFetch } from "@/lib/client";

export type ModalityConfig = {
  AET: string;
  Host: string;
  Port: number;
  Manufacturer?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export const modalitiesApi = {
  list: () => orthancFetch<string[]>("/modalities"),

  // GET /modalities/{id} returns sub-operation names in modern Orthanc.
  // The actual config is at /modalities/{id}/configuration.
  get: (name: string) => orthancFetch<ModalityConfig>(`/modalities/${name}/configuration`),

  put: (name: string, body: ModalityConfig) =>
    orthancFetch<void>(`/modalities/${name}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),

  delete: (name: string) =>
    orthancFetch<void>(`/modalities/${name}`, { method: "DELETE" }),

  echo: (name: string) =>
    orthancFetch<Record<string, unknown>>(`/modalities/${name}/echo`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    }),
};
