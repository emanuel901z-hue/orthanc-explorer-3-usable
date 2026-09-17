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
| `POST` | `/api/v1/sources/{id}/echo` | "Run C-ECHO now" button |
| `POST` | `/api/v1/targets/{id}/echo` | "Run C-ECHO now" button |
| `POST/PUT/DELETE` | `/api/v1/sources`, `/api/v1/targets`, `/api/v1/rules` | Typed client is ready (`src/api/broker.ts`) — CRUD editors are a planned UI phase |

Minimum fields the UI reads:

- `status`: `scp_listening`, `db_ok`, `counts.{queries,stores,seen_items}`,
  `sources[]` / `targets[]` with `{kind,id,name,ok,rtt_ms,last_check,error}`
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
npx vitest run --coverage     # unit tests + coverage for the broker UI
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
