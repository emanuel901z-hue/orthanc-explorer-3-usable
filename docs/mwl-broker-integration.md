# MWL Broker — Integration

Optional feature that renders a DICOM Modality Worklist broker UI inside OE3:
a **monitoring dashboard** (status, echo matrix, live C-FIND query log) and the
**full configuration** (upstream sources, store targets, routing rules, DICOM
modify rules, runtime settings). The UI talks to a **separate broker service
over REST only** — no Python, no extra containers, and no Orthanc changes are
required in this repository.

## Pages

| Route | Purpose |
|---|---|
| `/broker` | Monitoring: SCP/DB status, C-ECHO matrix with RTT, counters, live query log |
| `/broker/sources` | Upstream RIS/KIS systems: CRUD, enable/disable, priority, charset, C-ECHO |
| `/broker/targets` | PACS store targets: CRUD, default target, C-ECHO |
| `/broker/rules` | Routing rules (source → target, priority, enable toggle) |
| `/broker/transforms` | DICOM modify rules (tag set/remove/prefix/suffix/replace/copy, scope, priority) |
| `/broker/settings` | Runtime settings (ENV default + UI override/reset) |
| `/broker/worklist` | Local worklist items + HL7 ORM interface check |
| `/broker/stations` | Per-station rules + source-visibility preview |
| `/broker/spool` | Store queue: queued instances, per-entry retry, discard with a reason |
| `/broker/audit` | Change log: before/after diff, rollback, configuration export/import (dry-run first) |

Sidebar: a collapsible “MWL Broker” group with all six entries (only rendered
when `brokerUrl` is configured). Every write goes through
`use-broker-writes.ts` and emits BEFORE/AFTER audit events, same contract as
`src/actions/`. The config tables switch to card layouts below `md`
(`ConfigRowCard`) — a four-column DICOM table does not fit a 375px viewport.

## Gating

The feature is invisible unless `brokerUrl` is configured in
`window.__OE3_CONFIG__` (or the `enableMwlBroker` feature flag is set):

```javascript
window.__OE3_CONFIG__ = {
  orthancUrl: "/orthanc-proxy",
  brokerUrl: "/broker-api",      // any reverse-proxy path or absolute URL
  authMode: "none",
  features: { enableMwlBroker: true },
};
```

Without `brokerUrl` the `/broker` route renders a "not configured" hint and
fires no requests.

## API contract (v1)

The UI consumes a versioned JSON API under `/api/v1`. Any backend that
implements the endpoints below works — the reference implementation is the
`mwl-broker` service (FastAPI + pynetdicom, auto-generated OpenAPI at
`/openapi.json`, Swagger UI at `/docs`).

| Method | Path | Used by |
|---|---|---|
| `GET` | `/api/v1/status` | Status cards + echo matrix (5 s polling) |
| `GET` | `/api/v1/logs/queries?limit=` | Live C-FIND query log (5 s polling) |
| `GET` | `/api/v1/sources` | Endpoint details next to echo badges |
| `GET` | `/api/v1/targets` | Default-target badge, endpoint details |
| `GET` | `/api/v1/health/config` | Configuration health panel (findings + summary) |
| `GET` | `/api/v1/audit/config` | Change log (diff + rollback) |
| `GET/POST` | `/api/v1/config/export`, `/api/v1/config/import?dry_run=` | Configuration export/import |
| `POST` | `/api/v1/config/rollback/{id}` | Roll a change back |
| `GET/POST/PUT/DELETE` | `/api/v1/local-items` | Local worklist items (emergencies) |
| `POST` | `/api/v1/hl7/orm?dry_run=`, `GET /api/v1/hl7/messages` | HL7 ORM intake + message log |
| `GET/POST/PUT/DELETE` | `/api/v1/station-rules` | Per-station filter and priority |
| `POST` | `/api/v1/simulate/station` | "What would this console see?" |
| `GET` | `/api/v1/tls/overview` | TLS state + certificate/key details (no key material) |
| `POST` | `/api/v1/tls/self-signed` | Generate a certificate (public PEM returned for hand-over) |
| `POST` | `/api/v1/tls/test` | Real handshake (+ optional C-ECHO) against an endpoint |
| `GET` | `/api/v1/atna/stats`, `POST /api/v1/atna/test`, `GET /api/v1/atna/sample` | ATNA audit trail |
| `GET` | `/api/v1/notify/events` | Alerting card: the event catalog (code, severity, description) |
| `POST` | `/api/v1/notify/test` | "Send test message" (returns the delivery result) |
| `GET` | `/api/v1/spool`, `/api/v1/spool/stats` | Store queue + spool card |
| `POST` | `/api/v1/spool/{id}/retry`, `/api/v1/spool/retry-all` | "Retry now" / "Retry all" |
| `DELETE` | `/api/v1/spool/{id}?reason=` | Discard (reason required, audited) |
| `GET` | `/api/v1/cache/stats`, `/api/v1/cache/items` | Worklist cache card |
| `DELETE` | `/api/v1/cache`, `/api/v1/cache/sources/{id}` | "Clear cache" (confirmed) |
| `POST` | `/api/v1/simulate/route`, `/api/v1/simulate/transform` | "Check a case" dry-run |
| `POST` | `/api/v1/sources/{id}/reset-breaker` | Circuit-breaker badge: operator reset |
| `POST` | `/api/v1/sources/{id}/echo` | "Run C-ECHO now" button |
| `POST` | `/api/v1/targets/{id}/echo` | "Run C-ECHO now" button |
| `POST/PUT/DELETE` | `/api/v1/sources`, `/api/v1/targets`, `/api/v1/rules` | Typed client is ready (`src/api/broker.ts`) — CRUD editors are a planned UI phase |

Minimum fields the UI reads:

- `status`: `scp_listening`, `db_ok`, `counts.{queries,stores,seen_items}`,
  `sources[]` / `targets[]` with `{kind,id,name,ok,rtt_ms,last_check,error}`;
  sources additionally carry `breaker_state` (`closed|half_open|open`) and
  `breaker_retry_in_s`
- `health/config`: `findings[]` with `{code,severity,message,entity,details}`
  plus `summary.{error,warning,info}` — the UI translates `code` and deep-links
  via `entity`
- `audit/config[]`: `{id,ts,actor,action,entity,entity_id,before_json,after_json}`
  — `before_json`/`after_json` drive the diff view; `id` drives the rollback
- `config/import` (dry-run): `{dry_run, changes[], skipped[], summary}` —
  `changes` are `{entity,action,name,fields}`; the UI shows them before applying
- `tls/overview`: `{inbound_enabled,inbound_port,inbound_client_auth,outbound_verify,
  directory,entries{},certificates[]}` — `entries` carries `ok/error/subject/days_left/
  expired/expiring_soon/san/is_ca` per role; private keys only report `mode` and
  `world_readable`, never the key
- `tls/self-signed`: `{certificate_path,key_path,certificate_pem,certificate,key,is_ca}`
- `tls/test`: `{ok,error,protocol,cipher,peer_subject,peer_issuer,peer_not_after,
  peer_san,echo_ok,echo_error}`
- `sources[]`/`targets[]` carry `tls` and `tls_verify`
- `local-items[]`: full item including the patient name — this is *actively
  maintained* data (the editor needs it), unlike the cache. The change log and
  the configuration export deliberately carry the schedule only, no patient data
- `hl7/orm?dry_run=true`: `{dry_run, action, parsed{}, warnings[]}` — the
  interface check; `dry_run=false` applies it and returns the affected item
- `hl7/messages[]`: `{ts,transport,message_type,control_id,order_control,accession,action,error}`
- `station-rules[]`: `{name,station_aet,mode,source_ids,source_priority,priority,enabled}`
- `simulate/station`: `{rule_id,rule_name,mode,sources[{id,name,visible,effective_priority}],reason}`
- `atna/stats`: `{enabled,configured,host,port,protocol,queue_size,queue_max,worker_running}`;
  `atna/sample` returns the XML the receiving team validates against
- `notify/events[]`: `{code, severity, description}` — the UI renders checkboxes
  from it, so a new event on the broker side shows up without a UI change
- `notify/test`: `{ok, error}` — the operator's check after configuring the
  webhook; the URL itself is a setting (`notify_webhook_url`, empty = off)
- `settings[]`: `notify_events` is a comma-separated list of event codes, the UI
  edits it as a picker and writes the same CSV back
- `spool/stats`: `{queued,failed,dead,sent,open,bytes,oldest_age_s,capacity,enabled,accept_when_queued}`
  — `capacity.full` drives the "spool full" badge; `dead` drives the error badge
- `spool[]`: `{id,sop_instance_uid,study_uid,accession,target_name,status,attempts,
  last_error,payload_bytes,age_s,next_attempt_at,sent_at}` — the DICOM payload
  stays on disk, the API never exposes patient data
- `logs/stores[]`: `status` may be `queued` (spooled for retry) or `duplicate`
  (already spooled/delivered, acknowledged without forwarding)
- `cache/stats[]`: `{source_id,source_name,entries,age_s,state,stale_on_error,refresh_s}`
  — `state` is `empty | available | expired`; the UI renders the fallback state
  and disables "clear" when nothing is cached
- `cache/items[]`: metadata only (`accession`, `study_uid`, `modality`,
  `station_aet`, `sps_status`, `age_s`) — deliberately **without** patient
  identifiers, even though the cached payload contains PHI
- `logs/queries[]`: `served_stale` lists the sources that had to be answered
  from the cache (the dashboard banner and the log badge read it)
- `sources[]` carry `cache_stale_on_error` and `cache_refresh_s`
- `simulate/*`: routing decision (`matched_via`, `target_name`, `rule_id`,
  `reason`) plus `rules_applied`, `changes[]` (`{tag,before,after}`) and
  `errors[]` — no side effects
- `sources[]` / `targets[]`: `{id,name,aet,host,port,enabled}` (+
  `is_default` for targets)
- `logs/queries[]`: `{ts,calling_aet,answers,per_source,duration_ms,status}`
- echo responses: `{ok,rtt_ms,error}`

## Deployment

Serve the UI and the broker API same-origin through your reverse proxy to
avoid CORS entirely:

```nginx
location /broker-api/ {
    proxy_pass http://mwl-broker:8081/;
}
```

For cross-origin setups (UI and broker on different hosts), the broker must
send CORS headers (`Access-Control-Allow-Origin`); same-origin is the
recommended production layout.

## Testing

```bash
npx vitest run --coverage     # unit tests + coverage for the broker UI (98 %)
npx playwright test --config=e2e/stack/playwright.stack.config.ts
node e2e/stack/verify-ui.cjs  # deep audit: DOM checks + CRUD flows vs. the API
```

Both E2E entry points need a running broker stack (the workspace repo provides
`./test-stack.sh`, which builds an isolated stack and tears it down again).

## Scope

The broker service itself (DICOM SCP, C-FIND fan-out/merge, C-STORE routing,
Postgres config/log DB) lives outside this repository — the UI slice here is
deliberately limited to the REST client, the pages above, runtime config, and
tests. This keeps the fork merge-friendly with upstream OE3.
