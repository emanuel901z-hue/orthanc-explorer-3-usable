/**
 * Typed wrappers for Orthanc series endpoints.
 *
 * Covered:
 *   GET    /series/:id            — seriesApi.get()
 *   GET    /series/:id/instances  — seriesApi.getInstances()
 *   DELETE /series/:id            — seriesApi.delete()
 */
// src/api/series.ts
import { orthancFetch } from "@/lib/client";

export type SeriesDetail = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentStudy: string;
  Instances: string[];
  Type: "Series";
};

export const seriesApi = {
  get: (id: string) => orthancFetch<SeriesDetail>(`/series/${id}`),

  getInstances: (id: string) => orthancFetch<string[]>(`/series/${id}/instances`),

  delete: (id: string) =>
    orthancFetch<void>(`/series/${id}`, { method: "DELETE" }),
};
