/**
 * Typed wrappers for Orthanc DICOMweb server endpoints.
 *
 * Covered:
 *   GET    /dicom-web/servers          — dicomWebServersApi.list()
 *   PUT    /dicom-web/servers/:name    — dicomWebServersApi.put()
 *   DELETE /dicom-web/servers/:name    — dicomWebServersApi.delete()
 *
 * Orthanc's DICOMweb plugin stores a minimal server definition:
 *   { Url, HasDelete, ChunkedTransfers, HttpHeaders, Pkcs11 }
 * Authentication is expressed via HttpHeaders (e.g. Authorization: Bearer ...).
 * The QIDO/WADO/STOW capability flags are properties of the remote server,
 * not of the local Orthanc configuration — Orthanc will use the server for
 * whatever the plugin supports. We persist the user-declared capabilities
 * alongside the name in a sidecar map (localStorage) so the UI can render
 * badges; Orthanc itself ignores them.
 */
// src/api/dicomWebServers.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type DicomWebServerConfig = {
  Url: string;
  HasDelete?: boolean;
  ChunkedTransfers?: boolean;
  HttpHeaders?: Record<string, string>;
  Pkcs11?: boolean;
};

/** Sidecar metadata stored in localStorage — Orthanc does not persist these. */
export type DicomWebServerMeta = {
  url: string;
  authType: 'none' | 'basic' | 'bearer' | 'oauth';
  username?: string;
  clientId?: string;
  clientSecret?: string;
  hasQidoSupport: boolean;
  hasWadoSupport: boolean;
  hasStowSupport: boolean;
};

const SIDECAR_KEY = 'oe3-dicomweb-server-meta';

function readSidecar(): Record<string, DicomWebServerMeta> {
  try {
    const raw = localStorage.getItem(SIDECAR_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DicomWebServerMeta>) : {};
  } catch {
    return {};
  }
}

function writeSidecar(map: Record<string, DicomWebServerMeta>): void {
  try {
    localStorage.setItem(SIDECAR_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export const dicomWebServersMeta = {
  get: (name: string): DicomWebServerMeta | undefined => readSidecar()[name],
  list: (): Record<string, DicomWebServerMeta> => readSidecar(),
  put: (name: string, meta: DicomWebServerMeta): void => {
    const map = readSidecar();
    map[name] = meta;
    writeSidecar(map);
  },
  delete: (name: string): void => {
    const map = readSidecar();
    delete map[name];
    writeSidecar(map);
  },
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
