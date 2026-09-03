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

export type OrthancInstance = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentSeries: string;
  Type: "Instance";
  FileSize?: number;
  /** Orthanc 1.13.0+: UUID of the file in the storage backend. */
  FileUuid?: string;
  /** Orthanc 1.13.0+: 0-based index of this instance within its series. */
  IndexInSeries?: number;
  /** Orthanc 1.13.0+: labels assigned to this instance. */
  Labels?: string[];
  /** Orthanc 1.13.0+: UUID of the resource this was modified from (or null). */
  ModifiedFrom?: string | null;
};
/** @deprecated Use OrthancInstance instead. */
export type Instance = OrthancInstance;

export const instancesApi = {
  /** GET /instances/:id — Returns OrthancInstance (ID, MainDicomTags, ParentSeries, Type, FileSize). */
  get: (id: string) => orthancFetch<OrthancInstance>(`/instances/${id}`),

  /** GET /instances/:id/tags — Returns all DICOM tags as { tag: value } map. */
  getTags: (id: string) => orthancFetch<Record<string, unknown>>(`/instances/${id}/tags`),

  /** GET /instances/:id/preview — Returns rendered PNG preview as Blob. */
  getPreview: (id: string) =>
    orthancFetch<Blob>(`/instances/${id}/preview`, {
      headers: { Accept: "image/png" },
      responseType: "blob",
    }),

  /** DELETE /instances/:id — Deletes a single instance. Returns 200 (void). */
  delete: (id: string) =>
    orthancFetch<void>(`/instances/${id}`, { method: "DELETE" }),

  /** POST /instances — Uploads a DICOM file. Body: File/Blob (application/dicom). Returns { ID, Status }. */
  upload: (file: File | Blob) =>
    orthancFetch<{ ID: string; Status: string }>("/instances", {
      method: "POST",
      headers: { "Content-Type": "application/dicom" },
      body: file,
    }),

  /** GET /instances/:id/metadata/:key — Returns a single Orthanc metadata value as plain text (e.g. TransferSyntax). */
  getMetadata: (id: string, key: string) =>
    orthancFetch<string>(`/instances/${id}/metadata/${key}`, { responseType: "text" }),
};
