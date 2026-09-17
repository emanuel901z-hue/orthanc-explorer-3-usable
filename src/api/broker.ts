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
 *   GET    /api/v1/transforms         POST /api/v1/transforms
 *   PUT    /api/v1/transforms/:id     DELETE /api/v1/transforms/:id
 *   GET    /api/v1/settings           PUT /api/v1/settings/:key
 *   DELETE /api/v1/settings/:key
 *   POST   /api/v1/sources/:id/reset-breaker
 *   GET    /api/v1/health/config
 *   GET    /api/v1/audit/config       GET /api/v1/config/export
 *   POST   /api/v1/config/import      POST /api/v1/config/rollback/:id
 *   POST   /api/v1/simulate/route     POST /api/v1/simulate/transform
 *   GET    /api/v1/cache/stats        GET /api/v1/cache/items
 *   DELETE /api/v1/cache              DELETE /api/v1/cache/sources/:id
 *   GET    /api/v1/notify/events      POST /api/v1/notify/test
 *   GET    /api/v1/spool              GET /api/v1/spool/stats
 *   POST   /api/v1/spool/:id/retry    POST /api/v1/spool/retry-all
 *   DELETE /api/v1/spool/:id?reason=
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
  /** May this source be answered from the worklist cache while unreachable? */
  cache_stale_on_error: boolean;
  /** Background refresh interval of the cached snapshot (0 = off). */
  cache_refresh_s: number;
  created_at: string;
};

/**
 * Write payload for a source. The cache fields are optional: the broker
 * applies its own defaults when they are omitted (matching the Pydantic
 * schema), while responses always carry them.
 */
export type BrokerSourceIn = Omit<
  BrokerSource, 'id' | 'created_at' | 'cache_stale_on_error' | 'cache_refresh_s'
> & {
  cache_stale_on_error?: boolean;
  cache_refresh_s?: number;
};

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

export type TransformOpKind = 'set' | 'remove' | 'prefix' | 'suffix' | 'replace' | 'copy';

/** One DICOM attribute modification (validated broker-side against the
 *  DICOM data dictionary; UIDs are rejected). */
export type TransformOperation = {
  op: TransformOpKind;
  tag: string;
  value?: string | null;
  pattern?: string | null;
  from_tag?: string | null;
};

export type BrokerTransform = {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  /** null = applies to any source */
  source_id: number | null;
  /** null = applies to any target */
  target_id: number | null;
  operations: TransformOperation[];
  created_at: string;
};

export type BrokerTransformIn = Omit<BrokerTransform, 'id' | 'created_at'>;

export type BrokerSetting = {
  key: string;
  value: string;
  default: string;
  /** 'db' = UI override active, 'env' = deployment default */
  source: 'db' | 'env';
  kind: 'bool' | 'int' | 'aets';
  description: string;
};

/** Circuit-breaker state of an upstream source. */
export type BreakerState = 'closed' | 'half_open' | 'open';

export type EchoStatus = {
  kind: 'source' | 'target';
  id: number;
  name: string;
  ok: boolean;
  rtt_ms: number | null;
  last_check: string | null;
  error: string | null;
  /** Sources only: skipped after repeated C-FIND failures. */
  breaker_state?: BreakerState | null;
  /** Seconds until the next probe (null unless the breaker is open). */
  breaker_retry_in_s?: number | null;
};

/** One alerting event the broker can push to a webhook. */
export type NotifyEvent = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
};

/** C-STORE spool backlog (store and forward). */
export type SpoolStats = {
  queued: number;
  failed: number;
  dead: number;
  sent: number;
  open: number;
  bytes: number;
  oldest_age_s: number | null;
  capacity: {
    items: number;
    bytes: number;
    max_items: number;
    max_bytes: number;
    full: boolean;
  };
  enabled: boolean;
  accept_when_queued: boolean;
};

export type SpoolStatus = 'queued' | 'failed' | 'dead' | 'sent';

/** One spooled C-STORE instance (metadata only, payload stays on disk). */
export type SpoolItem = {
  id: number;
  sop_instance_uid: string;
  study_uid: string;
  accession: string;
  source_id: number | null;
  target_id: number | null;
  target_name: string;
  status: SpoolStatus;
  attempts: number;
  last_error: string;
  payload_bytes: number;
  age_s: number;
  next_attempt_at: string | null;
  sent_at: string | null;
};

/** Worklist cache state of one source (outage bridge). */
export type CacheSource = {
  source_id: number;
  source_name: string;
  entries: number;
  age_s: number | null;
  state: 'empty' | 'available' | 'expired';
  stale_on_error: boolean;
  refresh_s: number;
  newest_fetched_at: string | null;
};

/** One cached worklist item — metadata only, no PHI. */
export type CacheItem = {
  source_id: number;
  source_name: string;
  accession: string;
  study_uid: string;
  modality: string;
  station_aet: string;
  sps_status: string;
  age_s: number;
  fetched_at: string;
};

export type BreakerResetResult = {
  source_id: number;
  name: string;
  state: BreakerState;
  failures: number;
  retry_in_s: number | null;
  last_error: string;
};

export type FindingSeverity = 'error' | 'warning' | 'info';

/** One configuration consistency finding (the UI translates `code`). */
export type BrokerFinding = {
  code: string;
  severity: FindingSeverity;
  message: string;
  entity: { kind?: string; id?: number; name?: string };
  details: Record<string, unknown>;
};

export type BrokerHealth = {
  findings: BrokerFinding[];
  summary: Record<FindingSeverity, number>;
};

/** One configuration change-log entry (before/after snapshots). */
export type ConfigAuditEntry = {
  id: number;
  ts: string;
  actor: string;
  action: string;
  entity: 'source' | 'target' | 'rule' | 'transform' | 'setting';
  entity_id: number | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  correlation_id: string;
};

/** Portable configuration document (export/import). */
export type ConfigDocument = {
  schema_version: number;
  exported_at?: string | null;
  sources: BrokerSourceIn[];
  targets: BrokerTargetIn[];
  rules: { source: string; target: string; priority: number; enabled: boolean }[];
  transforms: {
    name: string;
    enabled: boolean;
    priority: number;
    source?: string | null;
    target?: string | null;
    operations: TransformOperation[];
  }[];
  settings: Record<string, string>;
};

export type ImportChange = {
  entity: string;
  action: 'create' | 'update';
  name: string;
  fields: Record<string, unknown>;
};

export type ImportPlan = {
  schema_version: number;
  dry_run: boolean;
  changes: ImportChange[];
  skipped: string[];
  summary: { create: number; update: number; skipped: number };
};

export type RoutingDecision = {
  accession: string;
  study_uid: string;
  matched_via: 'accession' | 'study_uid' | 'default' | 'none';
  source_id: number | null;
  source_name: string | null;
  target_id: number | null;
  target_name: string | null;
  rule_id: number | null;
  reason: string;
};

export type TagChange = { tag: string; before: string; after: string };

export type TransformSimulation = RoutingDecision & {
  rules_applied: string[];
  changes: TagChange[];
  errors: string[];
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
  /** Sources that had to be answered from the worklist cache. */
  served_stale?: string[] | null;
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

/**
 * Broker error responses (409/404/422) carry configuration-level messages —
 * "unknown DICOM keyword 'Nope'", "ris-a already exists" — never PHI. Those
 * are worth showing in the UI, so they are read here; every other status
 * keeps the scrubbed default from OrthancError.
 */
async function configErrorDetail(res: Response): Promise<string | null> {
  if (![404, 409, 422].includes(res.status)) return null;
  try {
    const body = await res.clone().json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(String).join('; ');
  } catch {
    /* not JSON — fall back to the scrubbed message */
  }
  return null;
}

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
      const detail = await configErrorDetail(res);
      const err = detail
        ? new OrthancError(res.status, correlationId, detail)
        : await OrthancError.from(res, correlationId);
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
    resetBreaker: (id: number) =>
      brokerFetch<BreakerResetResult>(`/api/v1/sources/${id}/reset-breaker`, post({})),
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

  transforms: {
    list: () => brokerFetch<BrokerTransform[]>('/api/v1/transforms'),
    create: (body: BrokerTransformIn) =>
      brokerFetch<BrokerTransform>('/api/v1/transforms', post(body)),
    update: (id: number, body: BrokerTransformIn) =>
      brokerFetch<BrokerTransform>(`/api/v1/transforms/${id}`, put(body)),
    delete: (id: number) => brokerFetch<void>(`/api/v1/transforms/${id}`, { method: 'DELETE' }),
  },

  settings: {
    list: () => brokerFetch<BrokerSetting[]>('/api/v1/settings'),
    set: (key: string, value: string) =>
      brokerFetch<BrokerSetting>(`/api/v1/settings/${encodeURIComponent(key)}`, put({ value })),
    reset: (key: string) =>
      brokerFetch<void>(`/api/v1/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },

  health: {
    config: () => brokerFetch<BrokerHealth>('/api/v1/health/config'),
  },

  notify: {
    events: () => brokerFetch<NotifyEvent[]>('/api/v1/notify/events'),
    test: () => brokerFetch<{ ok: boolean; error: string }>('/api/v1/notify/test', post({})),
  },

  spool: {
    stats: () => brokerFetch<SpoolStats>('/api/v1/spool/stats'),
    items: (params: { status?: string; limit?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      query.set('limit', String(params.limit ?? 100));
      return brokerFetch<SpoolItem[]>(`/api/v1/spool?${query.toString()}`);
    },
    retry: (id: number) =>
      brokerFetch<{ requeued: number }>(`/api/v1/spool/${id}/retry`, post({})),
    retryAll: () => brokerFetch<{ requeued: number }>('/api/v1/spool/retry-all', post({})),
    discard: (id: number, reason: string) =>
      brokerFetch<void>(
        `/api/v1/spool/${id}?reason=${encodeURIComponent(reason)}`,
        { method: 'DELETE' },
      ),
  },

  cache: {
    stats: () => brokerFetch<CacheSource[]>('/api/v1/cache/stats'),
    items: (params: { sourceId?: number; limit?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.sourceId !== undefined) query.set('source_id', String(params.sourceId));
      query.set('limit', String(params.limit ?? 100));
      return brokerFetch<CacheItem[]>(`/api/v1/cache/items?${query.toString()}`);
    },
    clear: () => brokerFetch<void>('/api/v1/cache', { method: 'DELETE' }),
    clearSource: (sourceId: number) =>
      brokerFetch<void>(`/api/v1/cache/sources/${sourceId}`, { method: 'DELETE' }),
  },

  audit: {
    config: (params: { entity?: string; limit?: number; offset?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.entity) query.set('entity', params.entity);
      query.set('limit', String(params.limit ?? 50));
      if (params.offset) query.set('offset', String(params.offset));
      return brokerFetch<ConfigAuditEntry[]>(`/api/v1/audit/config?${query.toString()}`);
    },
    rollback: (auditId: number) =>
      brokerFetch<{ audit_id: number; entity: string; action: string; message: string }>(
        `/api/v1/config/rollback/${auditId}`, post({}),
      ),
  },

  config: {
    export: () => brokerFetch<ConfigDocument>('/api/v1/config/export'),
    import: (doc: ConfigDocument, dryRun = true) =>
      brokerFetch<ImportPlan>(`/api/v1/config/import?dry_run=${dryRun}`, post(doc)),
  },

  simulate: {
    route: (body: { accession?: string; study_uid?: string }) =>
      brokerFetch<RoutingDecision>('/api/v1/simulate/route', post(body)),
    transform: (body: {
      accession?: string; study_uid?: string;
      source_id?: number | null; target_id?: number | null;
      values?: Record<string, string>;
    }) => brokerFetch<TransformSimulation>('/api/v1/simulate/transform', post(body)),
  },

  logs: {
    queries: (limit = 50) => brokerFetch<QueryLogRow[]>(`/api/v1/logs/queries?limit=${limit}`),
    stores: (limit = 50) => brokerFetch<StoreLogRow[]>(`/api/v1/logs/stores?limit=${limit}`),
  },
};
