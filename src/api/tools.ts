/**
 * Typed wrappers for Orthanc generic tools endpoints.
 *
 * Covered:
 *   POST /tools/lookup        — toolsApi.lookup()
 *   POST /tools/create-archive — toolsApi.createArchive() (multi-resource ZIP)
 */
// src/api/tools.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type LookupResult = {
  ID: string;
  Path: string;
  Type: 'Patient' | 'Study' | 'Series' | 'Instance';
};

export const toolsApi = {
  /** POST /tools/lookup — Looks up a DICOM UID (e.g. StudyInstanceUID) and returns the Orthanc resource path. */
  lookup: (body: string | Record<string, unknown>) =>
    orthancFetch<LookupResult>('/tools/lookup', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /**
   * POST /tools/create-archive — Creates a ZIP archive containing multiple resources.
   * Body: { Resources: [id1, id2, ...] } where IDs can be studies, series, or instances.
   * Returns a Blob (application/zip) containing all specified resources as DICOM files.
   * This is the efficient way to download multiple series at once.
   */
  createArchive: (resourceIds: string[]) =>
    orthancFetch<Blob>('/tools/create-archive', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ Resources: resourceIds }),
      responseType: 'blob',
    }),
};
