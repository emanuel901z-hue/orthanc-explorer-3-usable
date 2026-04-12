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
  list: () => orthancFetch<string[]>('/dicom-web/servers'),

  put: (name: string, body: DicomWebServerConfig) =>
    orthancFetch<void>(`/dicom-web/servers/${name}`, {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  delete: (name: string) => orthancFetch<void>(`/dicom-web/servers/${name}`, { method: 'DELETE' }),
};
