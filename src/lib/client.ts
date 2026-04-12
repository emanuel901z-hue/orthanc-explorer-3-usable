/**
 * orthancFetch — central transport layer for all Orthanc HTTP requests.
 *
 * Responsibilities:
 * - Prepends orthancUrl from runtime config to every path (empty = same-origin plugin mode)
 * - Attaches a UUIDv4 X-Request-Id correlation header to every request
 * - Stubs auth header injection per authMode (basic/oidc/smart filled in future phases)
 * - Tracks connection health via healthTracker on every response (success and failure)
 * - Throws OrthancError (PHI-safe) for non-2xx responses
 * - Returns undefined for 204 No Content; parses JSON for all other 2xx responses
 * - Network/unexpected errors call healthTracker.recordFailure() before re-throwing
 */

import { getConfig, type OE3Config } from "@/config/runtime";
import { newCorrelationId } from "./correlation";
import { healthTracker } from "./health";
import { OrthancError } from "./errors";
import { logger } from "./logger";

async function attachAuthHeaders(headers: Headers, cfg: OE3Config): Promise<void> {
  switch (cfg.authMode) {
    case "none": return;
    case "basic": {
      // Dev/simple deployments — browser credential prompt or env injection.
      // Real implementation added when basic-auth deployment is exercised.
      return;
    }
    case "oidc":
    case "smart": {
      // Phase 2: pull bearer token from fhirclient / oidc-client-ts.
      return;
    }
  }
}

export async function orthancFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cfg = getConfig();
  const correlationId = newCorrelationId();
  const url = cfg.orthancUrl ? `${cfg.orthancUrl}${path}` : path;

  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", correlationId);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  await attachAuthHeaders(headers, cfg);

  try {
    const res = await fetch(url, { ...init, headers, credentials: "include" });
    healthTracker.record(res.ok, res.status);
    if (!res.ok) {
      const err = await OrthancError.from(res, correlationId);
      logger.error("orthanc.fetch.failed", {
        path, status: err.status, correlationId,
      });
      throw err;
    }
    if (res.status === 204) return undefined as T;
    // Non-JSON 2xx bodies will throw a SyntaxError here; callers using binary
    // endpoints (e.g., /archive) must override Accept and handle the raw Response.
    return (await res.json()) as T;
  } catch (e) {
    if (!(e instanceof OrthancError)) {
      healthTracker.recordFailure();
      logger.error("orthanc.fetch.failed", { path, correlationId });
    }
    throw e;
  }
}
