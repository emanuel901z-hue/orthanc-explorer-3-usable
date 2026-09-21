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
 *   GET    /api/v1/local-items        POST /api/v1/local-items
 *   PUT    /api/v1/local-items/:id    DELETE /api/v1/local-items/:id
 *   POST   /api/v1/hl7/orm            GET /api/v1/hl7/messages
 *   GET    /api/v1/station-rules      POST /api/v1/station-rules
 *   POST   /api/v1/simulate/station
 *   GET    /api/v1/atna/stats         POST /api/v1/atna/test   GET /api/v1/atna/sample
 *   GET    /api/v1/tls/overview       POST /api/v1/tls/self-signed   POST /api/v1/tls/test
 *   GET    /api/v1/rbac/status        GET /api/v1/retention   POST /api/v1/retention/purge
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
  /** Use DICOM TLS towards this source. */
  tls: boolean;
  /** Verify the server certificate (off only for a self-signed lab system). */
  tls_verify: boolean;
  created_at: string;
};

/**
 * Write payload for a source. The cache fields are optional: the broker
 * applies its own defaults when they are omitted (matching the Pydantic
 * schema), while responses always carry them.
 */
export type BrokerSourceIn = Omit<
  BrokerSource, 'id' | 'created_at' | 'cache_stale_on_error' | 'cache_refresh_s'
  | 'tls' | 'tls_verify'
> & {
  cache_stale_on_error?: boolean;
  cache_refresh_s?: number;
  tls?: boolean;
  tls_verify?: boolean;
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
  /** Use DICOM TLS towards this PACS. */
  tls: boolean;
  /** Verify the PACS certificate (off only for a self-signed lab system). */
  tls_verify: boolean;
  created_at: string;
};

export type BrokerTargetIn = Omit<BrokerTarget, 'id' | 'created_at' | 'tls' | 'tls_verify'> & {
  tls?: boolean;
  tls_verify?: boolean;
};

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
  /** Value type — `enum:<a,b>` carries its choices in the same string. */
  kind: 'bool' | 'int' | 'aets' | 'str' | 'url' | 'path' | 'events' | string;
  description: string;
  /** Lower bound for integer settings (null for other kinds). */
  min?: number | null;
  /** Upper bound for integer settings (null for other kinds). */
  max?: number | null;
  /** Allowed values for enum settings. */
  choices?: string[];
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

/** A locally maintained worklist item (emergency / unscheduled exam). */
export type LocalItem = {
  id: number;
  accession: string;
  sps_id: string;
  patient_id: string;
  patient_name: string;
  birth_date: string;
  sex: string;
  modality: string;
  station_aet: string;
  procedure_description: string;
  scheduled_date: string;
  scheduled_time: string;
  study_uid: string;
  sps_status: string;
  valid_until: string | null;
  enabled: boolean;
  origin: 'manual' | 'hl7';
  created_at: string;
  updated_at: string;
};

export type LocalItemIn = Omit<LocalItem, 'id' | 'origin' | 'created_at' | 'updated_at'>;

/** Result of an HL7 ORM message (dry-run shows what would happen). */
export type Hl7Parse = {
  dry_run: boolean;
  message_type: string;
  control_id: string;
  order_control: string;
  accession: string;
  action: string;
  item: LocalItem | null;
  parsed: Record<string, unknown>;
  warnings: string[];
};

/** One inbound HL7 message (troubleshooting log). */
export type Hl7Message = {
  id: number;
  ts: string;
  transport: string;
  message_type: string;
  control_id: string;
  order_control: string;
  accession: string;
  action: string;
  error: string;
};

/** Per-station worklist rule (filter + priority override). */
export type StationRule = {
  id: number;
  name: string;
  station_aet: string;
  mode: 'allow' | 'deny';
  source_ids: number[];
  source_priority: Record<string, number>;
  priority: number;
  enabled: boolean;
  created_at: string;
};

export type StationRuleIn = Omit<StationRule, 'id' | 'created_at'>;

/** What a station would see — a dry-run of the station rules. */
export type StationPreview = {
  station_aet: string;
  rule_id: number | null;
  rule_name: string | null;
  mode: 'allow' | 'deny' | null;
  sources: { id: number; name: string; visible: boolean; effective_priority: number }[];
  reason: string;
};

/** Access mode for this caller (decided by the proxy). */
export type RbacStatus = {
  mode: string;
  enforced: boolean;
  roles_header: string;
  write_role: string;
  roles: string[];
  can_write: boolean;
};

/** Retention state of one table. */
export type RetentionTable = {
  table: string;
  description: string;
  rows: number;
  oldest: string | null;
  retention_days: number;
  will_delete: number;
};

/** Retention overview for the UI. */
export type RetentionOverview = {
  tables: RetentionTable[];
};

/** State of one configured certificate file (never key material). */
export type TlsCertificate = {
  path: string;
  exists: boolean;
  ok: boolean;
  error: string;
  subject: string;
  issuer: string;
  self_signed: boolean;
  serial: string;
  not_before: string;
  not_after: string;
  days_left: number | null;
  expired: boolean;
  expiring_soon: boolean;
  san: string[];
  is_ca: boolean;
  signature_algorithm: string;
};

/** State of one private key file. */
export type TlsKey = {
  path: string;
  exists: boolean;
  ok: boolean;
  error: string;
  mode: string;
  world_readable: boolean;
  type: string;
  bits: number | null;
};

/** Certificate management overview. */
export type TlsOverview = {
  inbound_enabled: boolean;
  inbound_port: number;
  inbound_client_auth: string;
  outbound_verify: boolean;
  directory: string;
  entries: Record<string, TlsCertificate | TlsKey | { ok: boolean | null }>;
  certificates: {
    role: string;
    path: string;
    subject: string;
    days_left: number | null;
    expired: boolean;
    expiring_soon: boolean;
    error: string;
  }[];
};

/** Result of a TLS endpoint check. */
export type TlsTestResult = {
  host: string;
  port: number;
  ok: boolean;
  error: string;
  protocol: string;
  cipher: string;
  peer_subject: string;
  peer_issuer: string;
  peer_not_after: string;
  peer_san: string[];
  peer_days_left?: number;
  peer_self_signed?: boolean;
  echo_ok: boolean | null;
  echo_error: string;
};

/** State of the ATNA audit trail. */
export type AtnaStats = {
  enabled: boolean;
  configured: boolean;
  host: string;
  port: number;
  protocol: string;
  queue_size: number;
  queue_max: number;
  worker_running: boolean;
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

export type WorklistPreviewItem = {
  accession: string;
  study_uid: string;
  requested_procedure_id: string;
  sps_id: string;
  station_aet: string;
  modality: string;
  start_date: string;
  start_time: string;
  /** Source that won the merge for this item. */
  source: string;
  /** Other sources that answered the same case (deduplicated). */
  also_in: string[];
  /** Only present when the operator switched `simulate_show_phi` on. */
  patient_name?: string;
  patient_id?: string;
};

export type WorklistPreviewSource = {
  name: string;
  source_id: number | null;
  answers: number | string;
  stale: boolean;
  breaker_state?: string | null;
};

export type WorklistPreview = {
  station: string;
  rule: string | null;
  status: string;
  duration_ms: number;
  answers: number;
  hidden: number;
  /** Whether patient name/ID are included (setting `simulate_show_phi`). */
  phi: boolean;
  served_stale: string[];
  sources: WorklistPreviewSource[];
  items: WorklistPreviewItem[];
  truncated: boolean;
};

export type SourceQueryResult = {
  source_id: number;
  name: string;
  ok: boolean;
  error: string;
  answers: number;
  duration_ms: number;
  phi: boolean;
  items: WorklistPreviewItem[];
  truncated: boolean;
};

export type Hl7MessageDetail = {
  id: number;
  ts: string;
  transport: string;
  message_type: string;
  control_id: string;
  order_control: string;
  accession: string;
  action: string;
  error: string;
  /** The raw message — only present when `hl7_store_raw` is switched on (PHI). */
  raw: string;
  /** Whether the raw message is stored, so a replay is possible. */
  replayable: boolean;
};

export type Hl7ReprocessResult = {
  dry_run: boolean;
  action: string;
  item_id: number | null;
  error: string;
};

export type CacheRefreshResult = {
  sources: { name: string; source_id: number; items: number; duration_ms: number;
             ok: boolean; error: string }[];
};

export type MppsStep = {
  id: number;
  ts: string;
  sop_instance_uid: string;
  status: string;
  accession: string;
  patient_id: string;
  sps_id: string;
  station_aet: string;
  modality: string;
  study_uid: string;
  performed_procedure_step_id: string;
  started_at: string | null;
  ended_at: string | null;
  forwarded: boolean;
  forward_error: string;
  forward_attempts: number;
  forwarded_at: string | null;
};

export type MppsStats = {
  total: number;
  by_status: Record<string, number>;
  forwarded: number;
  pending_forward: number;
  last_error: string;
  forward_enabled: boolean;
  hide_completed: boolean;
};

export type BrokerStatus = {
  /** Broker version that is running (which build is deployed). */
  version: string;
  /** ISO timestamp the process started. */
  started_at: string;
  /** Seconds since the process started. */
  uptime_s: number;
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
    get: (id: number) => brokerFetch<BrokerSource>(`/api/v1/sources/${id}`),
    list: () => brokerFetch<BrokerSource[]>('/api/v1/sources'),
    create: (body: BrokerSourceIn) => brokerFetch<BrokerSource>('/api/v1/sources', post(body)),
    update: (id: number, body: BrokerSourceIn) =>
      brokerFetch<BrokerSource>(`/api/v1/sources/${id}`, put(body)),
    delete: (id: number) => brokerFetch<void>(`/api/v1/sources/${id}`, { method: 'DELETE' }),
    echo: (id: number) => brokerFetch<EchoStatus>(`/api/v1/sources/${id}/echo`, post({})),
    /** Ask one source directly whether it delivers worklists (real C-FIND). */
    query: (id: number, body: { accession?: string; modality?: string; scheduled_date?: string } = {}) =>
      brokerFetch<SourceQueryResult>(`/api/v1/sources/${id}/query`, post(body)),
    resetBreaker: (id: number) =>
      brokerFetch<BreakerResetResult>(`/api/v1/sources/${id}/reset-breaker`, post({})),
  },

  targets: {
    get: (id: number) => brokerFetch<BrokerTarget>(`/api/v1/targets/${id}`),
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
    get: (key: string) => brokerFetch<BrokerSetting>(`/api/v1/settings/${key}`),
    list: () => brokerFetch<BrokerSetting[]>('/api/v1/settings'),
    set: (key: string, value: string) =>
      brokerFetch<BrokerSetting>(`/api/v1/settings/${encodeURIComponent(key)}`, put({ value })),
    reset: (key: string) =>
      brokerFetch<void>(`/api/v1/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },

  health: {
    config: () => brokerFetch<BrokerHealth>('/api/v1/health/config'),
  },

  localItems: {
    list: () => brokerFetch<LocalItem[]>('/api/v1/local-items'),
    create: (body: LocalItemIn) =>
      brokerFetch<LocalItem>('/api/v1/local-items', post(body)),
    update: (id: number, body: LocalItemIn) =>
      brokerFetch<LocalItem>(`/api/v1/local-items/${id}`, put(body)),
    remove: (id: number) =>
      brokerFetch<void>(`/api/v1/local-items/${id}`, { method: 'DELETE' }),
  },

  hl7: {
    orm: (message: string, dryRun: boolean) =>
      brokerFetch<Hl7Parse>(`/api/v1/hl7/orm?dry_run=${dryRun ? 'true' : 'false'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: message,
      }),
    message: (id: number) => brokerFetch<Hl7MessageDetail>(`/api/v1/hl7/messages/${id}`),
    reprocess: (id: number, dryRun = true) =>
      brokerFetch<Hl7ReprocessResult>(
        `/api/v1/hl7/messages/${id}/reprocess?dry_run=${dryRun ? 'true' : 'false'}`, post({})),
    messages: (params: number | { limit?: number; offset?: number } = {}) => {
      const opts = typeof params === 'number' ? { limit: params } : params;
      const query = new URLSearchParams();
      query.set('limit', String(opts.limit ?? 50));
      if (opts.offset) query.set('offset', String(opts.offset));
      return brokerFetch<Hl7Message[]>(`/api/v1/hl7/messages?${query.toString()}`);
    },
  },

  mpps: {
    list: (limit = 50) => brokerFetch<MppsStep[]>(`/api/v1/mpps?limit=${limit}`),
    stats: () => brokerFetch<MppsStats>('/api/v1/mpps/stats'),
    /** Report finished steps to the RIS again (they failed while it was down). */
    forwardPending: () => brokerFetch<{ attempted: number; sent: number; failed: number }>(
      '/api/v1/mpps/forward-pending', post({})),
  },

  /** Run the real C-FIND aggregation and show what a modality would receive. */
  worklistPreview: (body: {
    station_aet?: string; accession?: string; modality?: string; scheduled_date?: string;
  } = {}) => brokerFetch<WorklistPreview>('/api/v1/simulate/worklist', post(body)),

  stationRules: {
    list: () => brokerFetch<StationRule[]>('/api/v1/station-rules'),
    create: (body: StationRuleIn) =>
      brokerFetch<StationRule>('/api/v1/station-rules', post(body)),
    update: (id: number, body: StationRuleIn) =>
      brokerFetch<StationRule>(`/api/v1/station-rules/${id}`, put(body)),
    remove: (id: number) =>
      brokerFetch<void>(`/api/v1/station-rules/${id}`, { method: 'DELETE' }),
    simulate: (stationAet: string) =>
      brokerFetch<StationPreview>('/api/v1/simulate/station', post({ station_aet: stationAet })),
  },

  rbac: {
    status: () => brokerFetch<RbacStatus>('/api/v1/rbac/status'),
  },

  retention: {
    overview: () => brokerFetch<RetentionOverview>('/api/v1/retention'),
    purge: (table?: string) =>
      brokerFetch<{ removed: Record<string, number>; total: number }>(
        `/api/v1/retention/purge${table ? `?table=${table}` : ''}`, post({})),
  },

  tls: {
    overview: () => brokerFetch<TlsOverview>('/api/v1/tls/overview'),
    generate: (body: { common_name: string; days: number; san: string[]; is_ca: boolean; filename: string }) =>
      brokerFetch<{ certificate_path: string; key_path: string; certificate_pem: string;
                    certificate: TlsCertificate; key: TlsKey; is_ca: boolean }>(
        '/api/v1/tls/self-signed', post(body)),
    /** Install a certificate/key pair from the hospital PKI (never returns the key). */
    upload: (body: { certificate_pem: string; key_pem: string; ca_pem?: string;
                     filename?: string; is_ca?: boolean }) =>
      brokerFetch<{ certificate_path: string; key_path: string; ca_path: string;
                    certificate: Record<string, unknown>; key: Record<string, unknown>;
                    is_ca: boolean }>('/api/v1/tls/upload', post(body)),
    test: (body: { host: string; port: number; verify?: boolean | null; ca_file?: string;
                   server_name?: string; echo_aet?: string; calling_aet?: string }) =>
      brokerFetch<TlsTestResult>('/api/v1/tls/test', post(body)),
  },

  atna: {
    stats: () => brokerFetch<AtnaStats>('/api/v1/atna/stats'),
    test: () => brokerFetch<{ ok: boolean; error: string }>('/api/v1/atna/test', post({})),
    sample: () => brokerFetch<{ xml: string }>('/api/v1/atna/sample'),
  },

  notify: {
    events: () => brokerFetch<NotifyEvent[]>('/api/v1/notify/events'),
    test: () => brokerFetch<{ ok: boolean; error: string }>('/api/v1/notify/test', post({})),
  },

  spool: {
    stats: () => brokerFetch<SpoolStats>('/api/v1/spool/stats'),
    items: (params: { status?: string; limit?: number; offset?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      query.set('limit', String(params.limit ?? 100));
      if (params.offset) query.set('offset', String(params.offset));
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
    /** Query the sources again and replace the cached snapshots (outage case). */
    refresh: (sourceId?: number) =>
      brokerFetch<CacheRefreshResult>(
        `/api/v1/cache/refresh${sourceId ? `?source_id=${sourceId}` : ''}`, post({})),
    clear: () => brokerFetch<void>('/api/v1/cache', { method: 'DELETE' }),
    clearSource: (sourceId: number) =>
      brokerFetch<void>(`/api/v1/cache/sources/${sourceId}`, { method: 'DELETE' }),
  },

  audit: {
    config: (params: { entity?: string; limit?: number; offset?: number; since?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.entity) query.set('entity', params.entity);
      query.set('limit', String(params.limit ?? 50));
      if (params.offset) query.set('offset', String(params.offset));
      if (params.since) query.set('since', params.since);
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
    queries: (params: number | { limit?: number; since?: string } = {}) => {
      const opts = typeof params === 'number' ? { limit: params } : params;
      const query = new URLSearchParams();
      query.set('limit', String(opts.limit ?? 50));
      if (opts.since) query.set('since', opts.since);
      return brokerFetch<QueryLogRow[]>(`/api/v1/logs/queries?${query.toString()}`);
    },
    stores: (params: number | { limit?: number; since?: string } = {}) => {
      const opts = typeof params === 'number' ? { limit: params } : params;
      const query = new URLSearchParams();
      query.set('limit', String(opts.limit ?? 50));
      if (opts.since) query.set('since', opts.since);
      return brokerFetch<StoreLogRow[]>(`/api/v1/logs/stores?${query.toString()}`);
    },
  },
};
