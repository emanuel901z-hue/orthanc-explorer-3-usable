# MWL Broker Dashboard — Integration

Optional feature that renders a DICOM Modality Worklist broker dashboard
(status, upstream sources, store targets, live C-FIND query log, C-ECHO
matrix) inside OE3. The UI talks to a **separate broker service over REST
only** — no Python, no extra containers, and no Orthanc changes are required
in this repository.

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

## Scope

The broker service itself (DICOM SCP, C-FIND fan-out/merge, C-STORE routing,
Postgres config/log DB) lives outside this repository — the UI slice here is
deliberately limited to the REST client, the dashboard page, runtime config,
and tests. This keeps the fork merge-friendly with upstream OE3.
