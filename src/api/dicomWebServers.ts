/**
 * Typed wrappers for Orthanc DICOMweb server endpoints.
 *
 * Covered:
 *   GET    /dicom-web/servers          — dicomWebServersApi.list()
 *   PUT    /dicom-web/servers/:name    — dicomWebServersApi.put()
 *   DELETE /dicom-web/servers/:name    — dicomWebServersApi.delete()
 */
// src/api/dicomWebServers.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type DicomWebServerConfig = {
  Url: string;
  HasDelete?: boolean;
  ChunkedTransfers?: boolean;
};

export const dicomWebServersApi = {
  /** GET /dicom-web/servers — Returns array of DICOMweb server names (string[]). */
  list: () => orthancFetch<string[]>('/dicom-web/servers'),

  /** PUT /dicom-web/servers/:name — Creates or updates a DICOMweb server. Returns 200 (void). */
  put: (name: string, body: DicomWebServerConfig) =>
    orthancFetch<void>(`/dicom-web/servers/${name}`, {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** DELETE /dicom-web/servers/:name — Removes a DICOMweb server. Returns 200 (void). */
  delete: (name: string) => orthancFetch<void>(`/dicom-web/servers/${name}`, { method: 'DELETE' }),
};
