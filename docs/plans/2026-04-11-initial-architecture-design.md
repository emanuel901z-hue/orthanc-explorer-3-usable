---
status: proposed
date: 2026-04-11
tags:
  - orthanc
  - architecture
  - healthcare
  - design
---

# Orthanc Explorer 3 — Initial Architecture Design

## Context

OE3 is a pure React/TypeScript SPA that replaces Orthanc Explorer 2 as a modern admin/management UI for Orthanc. It must run in three deployment modes from the same build artifact:

1. **Standalone Docker sidecar** — served by Nginx alongside Orthanc, talks to Orthanc over HTTP with CORS.
2. **Orthanc plugin (OE2 replacement)** — served same-origin by Orthanc's `ServeFolders`, no CORS, session auth passthrough.
3. **SMART on FHIR embedded** — launched inside an EHR iframe with a FHIR context + OAuth2 token, constrained to the launched patient.

Mode 1 is the v0.1 target. Modes 2 and 3 are configuration variations on top of mode 1, not separate builds.

The Lovable scaffolding (study list, study/series detail, activity timeline, job manager, navigation) already exists with mock data. This design covers how to wire it to a real Orthanc without boxing out the other two deployment modes.

## Goals

- One build artifact, N deployments.
- Every cross-cutting healthcare concern (auth, audit, PHI handling, health, errors) has exactly one place in the code.
- v0.1 ships in a weekend against a local Docker stack.
- Architectural seams for audit (ATNA), authorization (Authorization plugin), and federated OAuth DICOMweb (sibling OAuth plugin) exist from day one — even if the backing plugins aren't installed yet.

## Non-Goals for v0.1

- FDA-cleared diagnostic viewing. OE3 delegates diagnostic reads to OHIF/external viewers per the FDA positioning in `Orthanc-Explorer-3.md`.
- Custom authentication. OE3 never owns auth — it displays identity when the environment provides it.
- Full WCAG 2.1 AA audit (targeted after functionality).
- SBOM generation + pinned-digest production image (targeted after functionality).
- Comprehensive PHI log redaction rules beyond an allowlist logger.

---

## Deployment Modes

| Mode | Base URL to Orthanc | Auth | Served By |
|------|---------------------|------|-----------|
| Standalone | `http://orthanc:8042` (CORS) | `none` / `basic` / `oidc` | Nginx in OE3 container |
| Plugin | `""` (same-origin) | Orthanc session | Orthanc `ServeFolders` |
| SMART | `http://orthanc:8042` (CORS) | `smart` (bearer token from FHIR launch) | Anywhere the EHR can load it |

The SPA never knows at build time which mode it's in. Mode = the shape of `window.__OE3_CONFIG__` at runtime.

## Runtime Configuration

A single `/config.js` file is fetched before the React app boots. It sets `window.__OE3_CONFIG__`. The Docker entrypoint templates this file from environment variables.

```ts
// src/config/runtime.ts
export type OE3Config = {
  orthancUrl: string;          // "" when same-origin (plugin mode)
  authMode: "none" | "basic" | "oidc" | "smart";
  fhir?: {
    iss: string;
    clientId: string;
    scope: string;
  };
  features: Partial<Record<FeatureKey, boolean>>;  // deployment ceiling
  branding?: {
    title: string;
    logoUrl?: string;
  };
  frameAncestors?: string[];   // for SMART iframe embedding
};

export function getConfig(): OE3Config { /* reads window.__OE3_CONFIG__ */ }
```

Schema validation (via Zod) runs once at boot. Invalid config fails loudly with a visible error screen rather than silently producing broken behavior.

### Container entrypoint template

```sh
#!/bin/sh
cat > /usr/share/nginx/html/config.js <<EOF
window.__OE3_CONFIG__ = {
  orthancUrl: "${ORTHANC_URL:-}",
  authMode: "${AUTH_MODE:-none}",
  features: ${FEATURES_JSON:-{}},
  branding: { title: "${TITLE:-Orthanc Explorer 3}" },
  frameAncestors: ${FRAME_ANCESTORS_JSON:-[]}
};
EOF
exec nginx -g "daemon off;"
```

Plugin mode uses the same image but with `ORTHANC_URL=""` — or the SPA is copied into Orthanc's `ServeFolders` directory with a static `config.js`.

## Feature Flag Resolution

Feature visibility is resolved by a **layered** resolver. A feature is enabled only if **every applicable layer** says yes.

```
default ceiling (dev-permissive, "everything on")
    ∩
runtime config (deployment ceiling, set by ops)
    ∩
user profile (from Authorization plugin /auth/user/profile, if installed)
    ∩
SMART scopes (parsed from bearer token, if authMode === "smart")
```

```ts
// src/config/features.ts
export function useFeature(key: FeatureKey): boolean {
  const cfg = getConfig();
  const profile = useUserProfile();   // null if no Authorization plugin
  const scopes = useSmartScopes();    // null if not SMART mode

  if (cfg.features[key] === false) return false;
  if (profile && !profile.permissions.includes(key)) return false;
  if (scopes && !scopeAllows(scopes, key)) return false;
  return true;
}
```

Consumers never branch on mode. They call `useFeature("upload")`.

**v0.1 default:** everything on. Security hardening (flip to read-only default) is a later pass after all functionality works.

**UI reflection, not enforcement.** The hook is UX. Server-side enforcement lives in the Authorization plugin. Every API call must handle 403 gracefully regardless of what `useFeature` returned.

---

## Local Development Stack

Docker Compose at the repo root brings up a full miniature of the production architecture: Orthanc with all plugins, the OAuth DICOMweb plugin pointing at a local Azure emulator, and a placeholder OAuth token endpoint. The SPA runs from `npm run dev` against this stack.

```yaml
# docker-compose.dev.yml (in orthanc-explorer-3/)
services:
  orthanc:
    image: orthancteam/orthanc:latest-full
    ports:
      - "8042:8042"   # REST
      - "4242:4242"   # DICOM
    environment:
      ORTHANC__NAME: "OE3 Dev"
      ORTHANC__REMOTE_ACCESS_ALLOWED: "true"
      ORTHANC__AUTHENTICATION_ENABLED: "false"
      ORTHANC__DICOM_WEB__ENABLE: "true"
      ORTHANC__DICOM_MODALITIES_IN_DATABASE: "true"
      ORTHANC__ORTHANC_PEERS_IN_DATABASE: "true"
      ORTHANC__HTTP_HEADERS: |
        {"Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Request-Id"}
    volumes:
      - orthanc-data:/var/lib/orthanc/db
    depends_on:
      - oauth-plugin

  oauth-plugin:
    image: rhavekost/orthanc-dicomweb-oauth:latest
    environment:
      DICOMWEB_TARGET_URL: "http://azure-emulator:8080/v2"
      OAUTH_TOKEN_ENDPOINT: "http://azure-emulator:8080/oauth/token"  # emulator returns any token
      OAUTH_MODE: "dev"
    depends_on:
      - azure-emulator

  azure-emulator:
    image: rhavekost/azure-dicom-service-emulator:latest
    ports:
      - "8080:8080"
    environment:
      EMULATOR_AUTH_REQUIRED: "false"

  # Optional: seed test data on first boot from a public DICOM sample set.
  seeder:
    image: curlimages/curl:latest
    profiles: ["seed"]
    depends_on:
      - orthanc
    command: >
      sh -c "sleep 5 &&
             curl -X POST http://orthanc:8042/instances --data-binary @/seed/sample.dcm"
    volumes:
      - ./test-data:/seed:ro

volumes:
  orthanc-data:
```

Dev workflow:

```
docker compose -f docker-compose.dev.yml up -d
npm run dev    # Vite on :5173, talks to Orthanc on :8042
```

**Production image** is a separate multi-stage `Dockerfile` that builds the SPA and serves it with Nginx + the config.js entrypoint. Not part of this design doc.

---

## API Architecture — Four Layers

```
features/*          React Query hooks + components
    ↓
actions/*           User-intent wrappers: audit, confirmation, error UX
    ↓
api/*               Typed Orthanc endpoint functions (pure)
    ↓
lib/client.ts       Transport: auth, correlation IDs, PHI-safe errors, health
```

**Rule:** reads go through `api/*` directly via React Query hooks. Writes always go through `actions/*`. Lint/review enforces this.

### Layer 1 — `lib/client.ts`

The only place in the codebase that knows about auth modes, base URL, CORS, and correlation IDs.

```ts
export async function orthancFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cfg = getConfig();
  const correlationId = crypto.randomUUID();
  const url = cfg.orthancUrl ? `${cfg.orthancUrl}${path}` : path;

  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", correlationId);
  headers.set("Accept", "application/json");
  await attachAuthHeaders(headers, cfg);

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",   // same-origin plugin mode session cookie
    });
    healthTracker.record(res.ok, res.status);
    if (!res.ok) throw await OrthancError.from(res, correlationId);
    return res.status === 204 ? (undefined as T) : res.json();
  } catch (e) {
    healthTracker.recordFailure();
    logger.error("orthanc.fetch.failed", {
      path,
      status: (e as OrthancError)?.status,
      correlationId,
    });
    throw e;
  }
}
```

`attachAuthHeaders` dispatches on `cfg.authMode`:

- `none` — no-op
- `basic` — `Authorization: Basic <base64>` from browser credential prompt or env-injected default
- `oidc` — `Authorization: Bearer <token>` from OIDC library (e.g. `oidc-client-ts`)
- `smart` — `Authorization: Bearer <token>` from `fhirclient` library's stored token

### Layer 2 — `api/*`

Pure, typed endpoint functions. One module per Orthanc resource. No side effects, no audit, no toasts.

```ts
// src/api/studies.ts
export const studiesApi = {
  // PHI-bearing searches are POST — keeps PHI out of URLs, logs, history.
  find: (query: OrthancFindQuery) =>
    orthancFetch<Study[]>("/tools/find", {
      method: "POST",
      body: JSON.stringify(query),
      headers: { "Content-Type": "application/json" },
    }),
  get: (id: string) => orthancFetch<Study>(`/studies/${id}`),
  getSeries: (id: string) => orthancFetch<Series[]>(`/studies/${id}/series`),
  delete: (id: string) => orthancFetch<void>(`/studies/${id}`, { method: "DELETE" }),
  anonymize: (id: string, body: AnonymizeRequest) =>
    orthancFetch<Job>(`/studies/${id}/anonymize`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
```

Planned modules for v0.1: `studies`, `series`, `instances`, `modalities`, `peers`, `dicomWebServers`, `jobs`, `changes`, `system`, `tools`.

### Layer 3 — `actions/*`

The audit seam. Every user-intent mutation has an action wrapper that emits a structured event, handles confirmation/toast UX, and funnels errors through the same path.

```ts
// src/actions/deleteStudy.ts
export async function deleteStudyAction(study: Study, reason?: string) {
  const event = {
    action: "study.delete",
    resourceId: study.ID,              // Orthanc ID, not PHI
    resourceType: "study",
    timestamp: new Date().toISOString(),
    reason,
  };
  try {
    await studiesApi.delete(study.ID);
    auditClient.emit({ ...event, outcome: "success" });
    toast.success("Study deleted");
  } catch (e) {
    auditClient.emit({
      ...event,
      outcome: "failure",
      errorCode: (e as OrthancError).status,
    });
    toast.error("Failed to delete study");
    throw e;
  }
}
```

When the ATNA plugin lands, `auditClient.emit` changes to POST to `/audit/events`. Until then it calls `logger.info`. **Call sites don't change.**

### Layer 4 — `features/*`

React Query hooks and components. Thin. Never call `fetch`. Never call `orthancFetch`. Reads call `api/*`; writes call `actions/*`.

```ts
// src/features/studies/useDeleteStudy.ts
export const useDeleteStudy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStudyAction,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studies"] }),
  });
};
```

---

## Cross-Cutting Seams

Each of these is a single module that every relevant call site depends on. They start as stubs in v0.1 and harden over time.

| Seam | v0.1 Behavior | Future |
|------|---------------|--------|
| `lib/logger.ts` | Console + allowlist field redaction | Ship to structured log collector, full PHI scrubber |
| `lib/health.ts` | In-memory health tracker, global banner on consecutive failures | Multi-endpoint health, SLO surfacing |
| `lib/errors.ts` | `OrthancError` class + React error boundary with scrubbed display | Error telemetry with correlation IDs |
| `lib/audit.ts` (`auditClient`) | `logger.info` passthrough | POSTs to Orthanc ATNA plugin `/audit/events` |
| `lib/correlation.ts` | UUIDv4 per request in `X-Request-Id` | Threaded into user-facing error toasts |

## State Management

Two separate Zustand stores. They never merge. Logout clears `sessionStore`.

```ts
// src/store/uiStore.ts  — persisted to localStorage, contains NO PHI
{
  theme: "light" | "dark" | "system",
  sidebarCollapsed: boolean,
  studyListColumns: ColumnConfig[],
  savedSearchPresets: SearchPreset[],   // preset shape, not results
}

// src/store/sessionStore.ts  — memory only, cleared on logout/unmount
{
  currentStudyId: string | null,
  selectedStudyIds: Set<string>,
  activeFilter: StudyFilter,            // may contain PHI strings
  openTabs: StudyTab[],                 // IDE-style open studies
}
```

**PHI rules enforced in code:**

- Search submissions use POST (`/tools/find`) — never GET with query string.
- URL query params carry opaque IDs (Orthanc UUIDs), never patient names or MRNs.
- `localStorage` is allow-listed — `sessionStore` cannot be persisted by accident.
- `logger.error` takes structured fields; free-form strings with PHI are caught in review.

## Healthcare Architecture Patterns — v0.1 Split

**In v0.1 (cheap now, expensive later):**

1. Zero-trust handling of 403 on every endpoint.
2. PHI hygiene — POST for PHI-bearing searches, no PHI in URLs/localStorage.
3. `actions/` audit seam (call sites exist, backend is a stub).
4. `healthTracker` polling + global degradation banner.
5. CSP header + runtime `frameAncestors` field for SMART mode.
6. `uiStore` / `sessionStore` split.
7. Correlation IDs on every request.
8. De-identified test data only (public DICOM samples, no real studies in CI).

**Deferred (after functionality works):**

- Full WCAG 2.1 AA audit (shadcn/Radix gets us ~80% by default).
- SBOM generation + pinned production image digests.
- Full PHI redaction rules in logger (start with allowlist).
- Aggressive session timeout behavior for clinical settings.
- Full error telemetry pipeline.

---

## v0.1 Scope

**In scope — must work end-to-end against the local Docker stack:**

- Runtime config loader (`/config.js` → `window.__OE3_CONFIG__`) with Zod validation.
- Layered `useFeature()` resolver with v0.1 "everything on" default.
- Four-layer API architecture: `lib/client.ts`, `api/*`, `actions/*`, `features/*`.
- All five cross-cutting seams (logger, health, errors, audit stub, correlation).
- `uiStore` / `sessionStore` split.
- Wire Lovable shells to real endpoints:
  - Study list → `POST /tools/find`
  - Study detail → `GET /studies/{id}` + `GET /studies/{id}/series`
  - Upload → `POST /instances` with drag-drop
  - Activity timeline → `GET /changes` polling
  - Job manager → `GET /jobs` polling
  - Settings: Modalities → `GET/PUT/DELETE /modalities/{name}` + C-Echo
  - Settings: DICOMweb servers → `GET/PUT/DELETE /dicom-web/servers/{name}`
  - Settings: System → `GET /system`, `GET /plugins`, `GET /statistics`
- Basic study actions via `actions/*`: delete, anonymize, modify, send, download ZIP.
- Auth adapter for `none` mode (dev). `basic` and `oidc` stubbed behind the same interface.
- Health banner on degradation.
- `docker-compose.dev.yml` with Orthanc + OAuth plugin + Azure emulator.
- Test data seeding profile (public DICOM samples).

**Out of scope for v0.1 (planned Phase 2+):**

- Embedded Cornerstone3D viewer (adapt existing `MultiSeriesViewer`).
- SMART on FHIR launch flow (`fhirclient` integration).
- Keycloak/OIDC login flow (stub behind auth interface).
- Worklist management tab.
- Remote sources C-FIND / C-MOVE UI.
- Real-time updates via `/changes` WebSocket-style polling beyond activity timeline.
- Production Dockerfile + CI/CD.
- Command palette (Cmd+K).

## Proposed File Layout

```
orthanc-explorer-3/
├── docker-compose.dev.yml           # Orthanc + OAuth + Azure emulator
├── test-data/                       # public DICOM samples for seeder
├── public/
│   └── config.js                    # dev placeholder, overwritten at container start
├── src/
│   ├── config/
│   │   ├── runtime.ts               # getConfig(), Zod schema, boot validation
│   │   └── features.ts              # useFeature() layered resolver
│   ├── lib/
│   │   ├── client.ts                # orthancFetch — the only fetch site
│   │   ├── logger.ts                # PHI-allowlist structured logger
│   │   ├── health.ts                # healthTracker + global banner hook
│   │   ├── errors.ts                # OrthancError, error boundary
│   │   ├── audit.ts                 # auditClient (stub for v0.1)
│   │   └── correlation.ts           # request-id generation
│   ├── api/
│   │   ├── studies.ts
│   │   ├── series.ts
│   │   ├── instances.ts
│   │   ├── modalities.ts
│   │   ├── peers.ts
│   │   ├── dicomWebServers.ts
│   │   ├── jobs.ts
│   │   ├── changes.ts
│   │   ├── system.ts
│   │   └── tools.ts
│   ├── actions/
│   │   ├── deleteStudy.ts
│   │   ├── anonymizeStudy.ts
│   │   ├── modifyStudy.ts
│   │   ├── sendStudy.ts
│   │   ├── downloadStudy.ts
│   │   └── uploadInstances.ts
│   ├── store/
│   │   ├── uiStore.ts               # persisted, no PHI
│   │   └── sessionStore.ts          # memory-only
│   ├── features/
│   │   ├── studies/
│   │   ├── series/
│   │   ├── upload/
│   │   ├── activity/
│   │   ├── jobs/
│   │   └── settings/
│   │       ├── modalities/
│   │       ├── dicomWebServers/
│   │       └── system/
│   ├── components/ui/               # shadcn primitives (already scaffolded)
│   └── pages/                       # router targets (already scaffolded)
└── docs/
    └── plans/
        └── 2026-04-11-initial-architecture-design.md  # this file
```

## Rollout Plan

### Day 1 — Foundation

1. `docker-compose.dev.yml` up, verify Orthanc REST responds, seed test data.
2. `config/runtime.ts` + `config/features.ts` + Zod schema + boot validation.
3. `lib/client.ts` + stubs for logger, health, errors, audit, correlation.
4. `api/studies.ts` + `api/system.ts` wired to real Orthanc.
5. Study list screen reads real data via `useStudies` + TanStack Query.

### Day 2 — Core Screens

1. Study detail → `api/studies.ts` + `api/series.ts`.
2. Upload → `actions/uploadInstances.ts` with drag-drop progress.
3. Activity timeline → `api/changes.ts` polling.
4. Job manager → `api/jobs.ts` polling.
5. Health banner live, error boundary catches and displays scrubbed errors.

### Day 3 — Settings + Actions

1. Settings: Modalities CRUD + C-Echo test button.
2. Settings: DICOMweb servers CRUD.
3. Settings: System info read-only.
4. `actions/deleteStudy.ts`, `actions/anonymizeStudy.ts`, `actions/sendStudy.ts`.
5. Auth adapter shell — `none` working, `basic` and `oidc` stubbed behind the interface.

### Post-v0.1

- Production Dockerfile + CI/CD (pinned base image digest, SBOM).
- Embedded Cornerstone3D viewer (adapt `MultiSeriesViewer`).
- SMART on FHIR launch flow.
- Full WCAG audit pass.
- ATNA plugin integration — change `auditClient.emit` implementation, zero call-site changes.
- Authorization plugin integration — `useUserProfile()` returns real data, feature resolver layer 2 activates.

## Open Questions

1. **OAuth token for local dev** — does the `orthanc-dicomweb-oauth` plugin require a valid JWT structure, or does `OAUTH_MODE=dev` accept a static dummy token? To verify when wiring the compose stack.
2. **Test data source** — Visible Human, pydicom samples, or custom synthetic set? Pick one known public source and check it into `test-data/`.
3. **CSP header from Nginx vs meta tag** — Nginx header is stricter; meta tag is portable to plugin mode (where Orthanc serves the file). Probably both, with the meta tag as a fallback.
4. **`fhirclient` library fit** — confirms as the SMART launch path when Phase 2 starts. Not needed for v0.1 but worth sanity-checking before we commit to it in the auth adapter shape.

## References

- `docs/Orthanc-Explorer-3.md` — vision, scope, FDA positioning
- `docs/enterprise-plugin-roadmap.md` — Phase 2+ plugin opportunities (ATNA, ACL, HL7, etc.)
- `docs/smart-on-fhir-integration.md` — SMART launch details
- Sibling project: `../orthanc-dicomweb-oauth/` — OAuth2 DICOMweb plugin
- Sibling project: `../azure-dicom-service-emulator/` — local Azure Health Data Services emulator
