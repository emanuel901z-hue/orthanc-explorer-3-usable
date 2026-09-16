/**
 * Typed client for the mwl-broker REST API.
 *
 * Unlike orthancFetch, requests go to `config.brokerUrl` (a separate service,
 * not Orthanc). Broker failures must NOT feed the Orthanc healthTracker —
 * broker health is surfaced on the broker dashboard itself.
 *
 * Covered endpoints (FastAPI router in mwl-broker/mwl_broker/api.py):
 *   GET    /api/v1/status
 *   GET    /api/v1/sources            POST /api/v1/sources
 *   PUT    /api/v1/sources/:id        DELETE /api/v1/sources/:id
 *   POST   /api/v1/sources/:id/echo
 *   (same shape for /targets)
 *   GET    /api/v1/rules              POST /api/v1/rules
 *   PUT    /api/v1/rules/:id          DELETE /api/v1/rules/:id
 *   GET    /api/v1/logs/queries       GET /api/v1/logs/stores
 */
import { getConfig } from '@/config/runtime';
import { newCorrelationId } from '@/lib/correlation';
import { OrthancError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { JSON_CONTENT_HEADERS } from '@/lib/client';

export type BrokerSource = {
  id: number;
  name: string;
  aet: string;
  host: string;
  port: number;
  calling_aet: string;
  charset: string;
  enabled: boolean;
  timeout_s: number;
  priority: number;
  created_at: string;
};

export type BrokerSourceIn = Omit<BrokerSource, 'id' | 'created_at'>;

export type BrokerTarget = {
  id: number;
  name: string;
  aet: string;
  host: string;
  port: number;
  calling_aet: string;
  enabled: boolean;
  is_default: boolean;
  created_at: string;
};

export type BrokerTargetIn = Omit<BrokerTarget, 'id' | 'created_at'>;

export type BrokerRule = {
  id: number;
  source_id: number;
  target_id: number;
  priority: number;
  enabled: boolean;
};

export type BrokerRuleIn = Omit<BrokerRule, 'id'>;

export type EchoStatus = {
  kind: 'source' | 'target';
  id: number;
  name: string;
  ok: boolean;
  rtt_ms: number | null;
  last_check: string | null;
  error: string | null;
};

export type BrokerStatus = {
  scp_listening: boolean;
  db_ok: boolean;
  sources: EchoStatus[];
  targets: EchoStatus[];
  counts: { queries: number; stores: number; seen_items: number };
};

export type QueryLogRow = {
  id: number;
  ts: string;
  calling_aet: string;
  query_keys: Record<string, unknown>;
  answers: number;
  per_source: Record<string, number | string>;
  duration_ms: number;
  status: string;
};

export type StoreLogRow = {
  id: number;
  ts: string;
  calling_aet: string;
  sop_instance_uid: string;
  study_uid: string;
  accession: string;
  source_id: number | null;
  target_id: number | null;
  status: string;
  error: string;
};

async function brokerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = getConfig();
  const correlationId = newCorrelationId();
  if (!cfg.brokerUrl) {
    throw new OrthancError(0, correlationId, 'MWL broker is not configured.');
  }
  const headers = new Headers(init.headers);
  headers.set('X-Request-Id', correlationId);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  try {
    const res = await fetch(`${cfg.brokerUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await OrthancError.from(res, correlationId);
      logger.error('broker.fetch.failed', { path, status: err.status, correlationId });
      throw err;
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (e) {
    if (e instanceof OrthancError) throw e;
    logger.error('broker.fetch.failed', { path, correlationId });
    throw new OrthancError(0, correlationId, 'Network error. Please try again.');
  }
}

const put = (body: unknown): RequestInit => ({
  method: 'PUT',
  headers: JSON_CONTENT_HEADERS,
  body: JSON.stringify(body),
});

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: JSON_CONTENT_HEADERS,
  body: JSON.stringify(body),
});

export const brokerApi = {
  status: () => brokerFetch<BrokerStatus>('/api/v1/status'),

  sources: {
    list: () => brokerFetch<BrokerSource[]>('/api/v1/sources'),
    create: (body: BrokerSourceIn) => brokerFetch<BrokerSource>('/api/v1/sources', post(body)),
    update: (id: number, body: BrokerSourceIn) =>
      brokerFetch<BrokerSource>(`/api/v1/sources/${id}`, put(body)),
    delete: (id: number) => brokerFetch<void>(`/api/v1/sources/${id}`, { method: 'DELETE' }),
    echo: (id: number) => brokerFetch<EchoStatus>(`/api/v1/sources/${id}/echo`, post({})),
  },

  targets: {
    list: () => brokerFetch<BrokerTarget[]>('/api/v1/targets'),
    create: (body: BrokerTargetIn) => brokerFetch<BrokerTarget>('/api/v1/targets', post(body)),
    update: (id: number, body: BrokerTargetIn) =>
      brokerFetch<BrokerTarget>(`/api/v1/targets/${id}`, put(body)),
    delete: (id: number) => brokerFetch<void>(`/api/v1/targets/${id}`, { method: 'DELETE' }),
    echo: (id: number) => brokerFetch<EchoStatus>(`/api/v1/targets/${id}/echo`, post({})),
  },

  rules: {
    list: () => brokerFetch<BrokerRule[]>('/api/v1/rules'),
    create: (body: BrokerRuleIn) => brokerFetch<BrokerRule>('/api/v1/rules', post(body)),
    update: (id: number, body: BrokerRuleIn) =>
      brokerFetch<BrokerRule>(`/api/v1/rules/${id}`, put(body)),
    delete: (id: number) => brokerFetch<void>(`/api/v1/rules/${id}`, { method: 'DELETE' }),
  },

  logs: {
    queries: (limit = 50) => brokerFetch<QueryLogRow[]>(`/api/v1/logs/queries?limit=${limit}`),
    stores: (limit = 50) => brokerFetch<StoreLogRow[]>(`/api/v1/logs/stores?limit=${limit}`),
  },
};
