/**
 * Viewer-session cookie request.
 *
 * Backend-proxy deployments (authMode "none" behind a JWT reverse proxy)
 * expose `POST /api/v1/pacs/viewer-session` to set the httpOnly cookie that
 * OHIF/DICOMweb needs. Standalone deployments (e.g. plain Orthanc behind a
 * local nginx, no backend proxy) do not have that endpoint — there the call
 * would only produce a 404 in the network log, so it is skipped via
 * `viewerSession: false` in the runtime config.
 *
 * Default is `true`: production keeps its existing behaviour.
 */
import { getConfig } from '@/config/runtime';

export async function requestViewerSession(): Promise<void> {
  if (!getConfig().viewerSession) return;
  try {
    await fetch('/api/v1/pacs/viewer-session', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Cookie may already be valid — continue to open the viewer.
  }
}
