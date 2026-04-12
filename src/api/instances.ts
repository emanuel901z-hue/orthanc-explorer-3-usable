/**
 * Typed wrappers for Orthanc instance endpoints.
 *
 * Covered:
 *   GET    /instances/:id          — instancesApi.get()
 *   GET    /instances/:id/tags     — instancesApi.getTags()
 *   GET    /instances/:id/preview  — instancesApi.getPreview()  (returns Blob)
 *   DELETE /instances/:id          — instancesApi.delete()
 *   POST   /instances              — instancesApi.upload()
 */
// src/api/instances.ts
import { orthancFetch } from "@/lib/client";

export type Instance = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentSeries: string;
  Type: "Instance";
};

export const instancesApi = {
  get: (id: string) => orthancFetch<Instance>(`/instances/${id}`),

  getTags: (id: string) => orthancFetch<Record<string, unknown>>(`/instances/${id}/tags`),

  getPreview: (id: string) =>
    orthancFetch<Blob>(`/instances/${id}/preview`, {
      headers: { Accept: "image/png" },
    }),

  delete: (id: string) =>
    orthancFetch<void>(`/instances/${id}`, { method: "DELETE" }),

  upload: (file: File | Blob) =>
    orthancFetch<{ ID: string; Status: string }>("/instances", {
      method: "POST",
      headers: { "Content-Type": "application/dicom" },
      body: file,
    }),
};
