/**
 * orthancFetch — central transport layer for all Orthanc HTTP requests.
 *
 * Responsibilities:
 * - Prepends orthancUrl from runtime config to every path (empty = same-origin plugin mode)
 * - Attaches a UUIDv4 X-Request-Id correlation header to every request
 * - Stubs auth header injection per authMode (basic/oidc/smart filled in future phases)
 * - Tracks connection health via healthTracker on every response (success and failure)
 * - Throws OrthancError (PHI-safe) for non-2xx responses
 * - Returns Blob when responseType "blob" is specified; parses JSON otherwise
 * - Network/unexpected errors call healthTracker.recordFailure() before re-throwing
 */

import { getConfig, type OE3Config } from '@/config/runtime';
import { newCorrelationId } from './correlation';
import { healthTracker } from './health';
import { OrthancError } from './errors';
import { logger } from './logger';

/** Shared Content-Type header for JSON request bodies. */
export const JSON_CONTENT_HEADERS = { 'Content-Type': 'application/json' } as const;

async function attachAuthHeaders(headers: Headers, cfg: OE3Config): Promise<void> {
  switch (cfg.authMode) {
    case 'none':
      return;
    case 'basic': {
      // Dev/simple deployments — browser credential prompt or env injection.
      // Real implementation added when basic-auth deployment is exercised.
      return;
    }
    case 'oidc':
    case 'smart': {
      // Phase 2: pull bearer token from fhirclient / oidc-client-ts.
      return;
    }
  }
}

export async function orthancFetch<T>(
  path: string,
  init: RequestInit & { responseType?: 'blob' | 'text'; silent404?: boolean } = {},
): Promise<T> {
  const cfg = getConfig();
  const correlationId = newCorrelationId();
  const url = cfg.orthancUrl ? `${cfg.orthancUrl}${path}` : path;

  const headers = new Headers(init.headers);
  headers.set('X-Request-Id', correlationId);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  await attachAuthHeaders(headers, cfg);

  try {
    const res = await fetch(url, { ...init, headers, credentials: 'include' });
    healthTracker.record(res.ok, res.status);
    if (!res.ok) {
      const err = await OrthancError.from(res, correlationId);
      // Suppress logging for expected 404s (e.g. labels not supported)
      if (!(init.silent404 && err.status === 404)) {
        logger.error('orthanc.fetch.failed', {
          path,
          status: err.status,
          correlationId,
        });
      }
      throw err;
    }
    if (res.status === 204) return undefined as T;
    if (init.responseType === 'blob') return (await res.blob()) as T;
    if (init.responseType === 'text') return (await res.text()) as T;
    // Read as text first — some Orthanc endpoints (PUT/DELETE) return 200 with
    // an empty body rather than 204.  Calling .json() on an empty body throws a
    // SyntaxError, so we parse only when there is actual content.
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (e) {
    if (!(e instanceof OrthancError)) {
      healthTracker.recordFailure();
      logger.error('orthanc.fetch.failed', { path, correlationId });
    }
    throw e;
  }
}
