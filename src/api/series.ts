/**
 * Typed wrappers for Orthanc series endpoints.
 *
 * Covered:
 *   GET    /series/:id            — seriesApi.get()
 *   GET    /series/:id/instances  — seriesApi.getInstances()
 *   GET    /series/:id/shared-tags — seriesApi.getSharedTags()
 *   DELETE /series/:id            — seriesApi.delete()
 *   GET    /series/:id/archive    — seriesApi.archive() (Blob)
 *   POST   /series/:id/modify     — seriesApi.modify()
 *   POST   /series/:id/anonymize  — seriesApi.anonymize()
 *   POST   /modalities/:name/store — seriesApi.sendToModality()
 */
// src/api/series.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from "@/lib/client";
import type { OrthancInstance } from "@/api/instances";

export type OrthancSeries = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentStudy: string;
  Instances: string[];
  Type: "Series";
  /** Orthanc 1.13.0+: expected number of instances (null if unknown). */
  ExpectedNumberOfInstances?: number | null;
  /** Orthanc 1.13.0+: whether the series has received all expected instances. */
  IsStable?: boolean;
  /** Orthanc 1.13.0+: labels assigned to this series. */
  Labels?: string[];
  /** Orthanc 1.13.0+: last update timestamp (YYYYMMDDTHHMMSS format). */
  LastUpdate?: string;
  /** Orthanc 1.13.0+: UUID of the resource this was modified from (or null). */
  ModifiedFrom?: string | null;
  /** Orthanc 1.13.0+: series status (e.g. 'Unknown', 'Complete'). */
  Status?: string;
};

/** @deprecated Use OrthancSeries — kept for backward compatibility */
export type SeriesDetail = OrthancSeries;

export const seriesApi = {
  /** GET /series/:id — Returns OrthancSeries (ID, MainDicomTags, ParentStudy, Instances, Status). */
  get: (id: string) => orthancFetch<OrthancSeries>(`/series/${id}`),

  /**
   * Returns either an array of UUID strings (older Orthanc builds) or an array
   * of full Instance objects (orthancteam/orthanc:latest-full with expand=true).
   * Callers must handle both shapes — use `isInstanceIdArray` to discriminate.
   */
  getInstances: (id: string) =>
    orthancFetch<string[] | OrthancInstance[]>(`/series/${id}/instances`),

  /** GET /series/:id/shared-tags — Returns tags shared by ALL instances (series-level DICOM tags only). */
  getSharedTags: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/series/${id}/shared-tags`),

  /** DELETE /series/:id — Deletes a series and all its instances. Returns 200 (void). */
  delete: (id: string) =>
    orthancFetch<void>(`/series/${id}`, { method: "DELETE" }),

  /** GET /series/:id/archive — Downloads a ZIP archive of the series. Returns Blob (application/zip). */
  archive: (id: string) =>
    orthancFetch<Blob>(`/series/${id}/archive`, { responseType: "blob" }),

  /** POST /series/:id/modify — Creates a modified copy. Body: { Replace, Remove }. Returns { ID, Path }. */
  modify: (id: string, body: Record<string, unknown>) =>
    orthancFetch<{ ID: string; Path: string }>(`/series/${id}/modify`, {
      method: "POST",
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** POST /series/:id/anonymize — Creates an anonymized copy. Body: { Remove, Replace, Keep }. Returns { ID, Path }. */
  anonymize: (id: string, body: Record<string, unknown> = {}) =>
    orthancFetch<{ ID: string; Path: string }>(`/series/${id}/anonymize`, {
      method: "POST",
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** POST /modalities/:name/store — Sends series to a DICOM modality via C-STORE. Body: { Resources: [seriesId] }. */
  sendToModality: (seriesId: string, modalityId: string) =>
    orthancFetch<void>(`/modalities/${encodeURIComponent(modalityId)}/store`, {
      method: "POST",
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ Resources: [seriesId] }),
    }),
};
