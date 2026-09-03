import { getConfig } from '@/config/runtime';

interface WadorsParams {
  studyUID: string;
  seriesUID: string;
  instanceUID: string;
  /** Frame index (1-based). Defaults to 1 for single-frame instances. */
  frame?: number;
  /** Override the DICOMweb root URL. */
  baseUrl?: string;
}

/**
 * Get the DICOMweb base URL from runtime config.
 * In dev: /orthanc-proxy/dicom-web (Vite proxy → localhost:8042)
 * In prod: /api/v1/pacs/orthanc/dicom-web (backend proxy with JWT auth)
 */
function getDicomWebBaseUrl(): string {
  const cfg = getConfig();
  // cfg.orthancUrl is "/api/v1/pacs/orthanc" in prod, "/orthanc-proxy" in dev
  return `${cfg.orthancUrl}/dicom-web`;
}

/**
 * Build a Cornerstone3D wadors: image ID pointing at Orthanc's DICOMweb endpoint.
 * Uses the runtime config to determine the correct base URL (dev vs prod).
 */
export function buildWadorsImageId({
  studyUID,
  seriesUID,
  instanceUID,
  frame = 1,
  baseUrl,
}: WadorsParams): string {
  const base = baseUrl ?? getDicomWebBaseUrl();
  return `wadors:${base}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}/frames/${frame}`;
}

/** Get the DICOMweb base URL (for metadata fetches etc.) */
export function getDicomWebUrl(): string {
  return getDicomWebBaseUrl();
}
