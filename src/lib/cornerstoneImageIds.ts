/** Default base URL — matches the Vite dev proxy (strips /orthanc-proxy prefix). */
const DEFAULT_BASE_URL = '/orthanc-proxy/dicom-web';

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
 * Build a Cornerstone3D wadors: image ID pointing at Orthanc's DICOMweb endpoint.
 *
 * The Vite dev proxy rewrites /orthanc-proxy → http://localhost:8042,
 * so Orthanc receives: GET /dicom-web/studies/.../frames/1 (standard WADO-RS).
 */
export function buildWadorsImageId({
  studyUID,
  seriesUID,
  instanceUID,
  frame = 1,
  baseUrl = DEFAULT_BASE_URL,
}: WadorsParams): string {
  return `wadors:${baseUrl}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}/frames/${frame}`;
}
