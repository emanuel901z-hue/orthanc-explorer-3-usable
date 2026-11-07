/**
 * Kopierziele (nur AET) — kleiner Dienst hinter /targets-api.
 *
 * Anders als die Orthanc-Modalitäten brauchen diese Ziele keine Adresse: den
 * C-MOVE-Auftrag bekommt das Hauptarchiv. Deshalb liegen sie in einem eigenen
 * Speicher, den alle Benutzer gemeinsam sehen.
 */
import { JSON_CONTENT_HEADERS } from '@/lib/client';
import { getConfig } from '@/config/runtime';
import { newCorrelationId } from '@/lib/correlation';
import { OrthancError, scrubbedHttpMessage } from '@/lib/errors';
import { logger } from '@/lib/logger';

export type CopyTarget = { aet: string; label?: string };

type Payload = { targets: CopyTarget[] };

function baseUrl(): string {
  return (getConfig().targetsUrl ?? '/targets-api').replace(/\/+$/, '');
}

/**
 * Eigener Fetch für den Ziele-Dienst (/targets-api): nicht über orthancFetch,
 * sonst landet orthancUrl (/orthanc-proxy) davor und der Request geht an
 * Orthanc statt an den Ziele-Container.
 */
async function targetsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const correlationId = newCorrelationId();
  const headers = new Headers(init.headers);
  headers.set('X-Request-Id', correlationId);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const url = `${baseUrl()}${path}`;
  try {
    const res = await fetch(url, { ...init, headers, credentials: 'include' });
    if (!res.ok) {
      const err = await OrthancError.from(res, correlationId);
      logger.error('targets.fetch.failed', { path: url, status: err.status, correlationId });
      throw err;
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (e) {
    if (e instanceof OrthancError) throw e;
    logger.error('targets.fetch.failed', { path: url, correlationId });
    throw new OrthancError(0, correlationId, scrubbedHttpMessage(0));
  }
}

let cachedTargets: CopyTarget[] | null = null;

export const targetsApi = {
  list: () =>
    targetsFetch<Payload>('/targets').then((payload) => {
      const list = payload?.targets ?? [];
      cachedTargets = list;
      return list;
    }),
  replace: (targets: CopyTarget[]) =>
    targetsFetch<Payload>('/targets', {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ targets }),
    }).then((payload) => {
      const list = payload?.targets ?? [];
      cachedTargets = list;
      return list;
    }),
};

/**
 * Löst einen Ziel-AET (z. B. "EE2003536EAS") in seinen Klartext-Alias
 * ("Uni-Greifswald") auf — aus dem geladenen Ziele-Dienst oder der Runtime-Config.
 */
export function resolveTargetLabel(aet: string | undefined): string | undefined {
  if (!aet) return undefined;
  const fromService = cachedTargets?.find((entry) => entry.aet === aet)?.label;
  if (fromService) return fromService;
  try {
    return getConfig().cmoveTargets?.find((entry) => entry.aet === aet)?.label;
  } catch {
    return undefined;
  }
}
