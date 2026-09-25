/**
 * Typed client for the Pulmopath backend PACS endpoints — these are NOT Orthanc
 * REST routes but PP-specific operations that need the backend (DB checks,
 * audit log, WORM-safe modify).
 *
 * They live under /api/v1/pacs/* on the same origin as the SPA and are
 * authenticated by the same JWT cookie as the Orthanc proxy, so every request
 * uses credentials: 'include' and no auth headers.
 *
 * Covered:
 *   POST /api/v1/pacs/quarantine/adopt — pulmopathPacsApi.quarantineStudy()
 */
import { getConfig } from '@/config/runtime';
import { JSON_CONTENT_HEADERS } from '@/lib/client';
import { newCorrelationId } from '@/lib/correlation';
import { OrthancError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * Base path of the PP PACS API. In production orthancUrl is
 * "/api/v1/pacs/orthanc" — strip the trailing /orthanc. In dev (or a
 * standalone deployment without the backend) the fallback points at the same
 * origin; the endpoint then simply answers 404.
 */
function pacsBaseUrl(): string {
  const orthancUrl = getConfig().orthancUrl;
  return orthancUrl && /\/orthanc\/?$/.test(orthancUrl)
    ? orthancUrl.replace(/\/orthanc\/?$/, '')
    : '/api/v1/pacs';
}

export interface QuarantineResult {
  success: boolean;
  /** New Orthanc study id — the modify replaced the study in place. */
  orthancStudyId: string;
  previousOrthancStudyId: string;
  quarantinePatientId: string;
  studyInstanceUid?: string;
  patientName?: string;
}

/**
 * Backend 400/404/409 responses carry operational messages — "study is linked
 * to an investigation and is needed", "already in quarantine" — never PHI.
 * Those are worth showing in the UI, so they are read here; every other status
 * keeps the scrubbed default from OrthancError.
 */
async function errorDetail(res: Response): Promise<string | null> {
  if (![400, 404, 409].includes(res.status)) return null;
  try {
    const body = await res.clone().json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    /* not JSON — fall back to the scrubbed message */
  }
  return null;
}

async function pacsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const correlationId = newCorrelationId();
  const headers = new Headers(init.headers);
  headers.set('X-Request-Id', correlationId);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  try {
    const res = await fetch(`${pacsBaseUrl()}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const detail = await errorDetail(res);
      const err = detail
        ? new OrthancError(res.status, correlationId, detail)
        : await OrthancError.from(res, correlationId);
      logger.error('pulmopath.pacs.failed', { path, status: err.status, correlationId });
      throw err;
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (e) {
    if (e instanceof OrthancError) throw e;
    logger.error('pulmopath.pacs.failed', { path, correlationId });
    throw new OrthancError(0, correlationId, 'Network error. Please try again.');
  }
}

export const pulmopathPacsApi = {
  /**
   * POST /quarantine/adopt — puts a study into quarantine: the backend renames
   * its PatientID to QRN-ADOPT-<timestamp> in place (KeepSource:false), so the
   * Orthanc study id changes. Reversible in PP ("Verwaiste Studien" →
   * Normalisieren). Answers 409 when the study belongs to an investigation or
   * is already quarantined.
   */
  quarantineStudy: (params: { orthancStudyId: string; reason?: string }) =>
    pacsFetch<QuarantineResult>('/quarantine/adopt', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(params),
    }),
};
