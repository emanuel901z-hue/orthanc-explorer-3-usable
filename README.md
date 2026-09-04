# Orthanc Explorer 3 — Usable Fork

> A modern React admin UI for [Orthanc](https://www.orthanc-server.com/) — the open-source DICOM server. Runs as a Docker sidecar with no backend server required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests: 191](https://img.shields.io/badge/tests-191%20passed-brightgreen)](#testing)
[![Languages: 9](https://img.shields.io/badge/i18n-9%20languages-blue)](#internationalization)

---

**Disclaimer:** Orthanc Explorer 3 is intended for informational, research, and administrative purposes. It is not FDA cleared and is not intended for primary diagnostic interpretation of medical images. Organizations requiring FDA-cleared diagnostic viewing should use an appropriately cleared viewer application.

---

## About This Fork

This is a community-maintained fork of [rhavekost/orthanc-explorer-3](https://github.com/rhavekost/orthanc-explorer-3) with production-oriented enhancements for deploying OE3 behind a JWT-authenticated backend proxy (e.g. in a hospital PACS environment with RBAC, MFA, and multi-tenant isolation).

### Fork Enhancements

| Feature | Description |
|---------|-------------|
| **Backend-Proxy Auth Mode** | `authMode: "none"` + `orthancUrl` pointing to a backend proxy that injects Orthanc credentials server-side. OE3 sends `credentials: 'include'` so httpOnly JWT cookies flow automatically. |
| **AuthGate** | SPA-level auth gate that calls `/oe3-me` on boot. Shows a login-required screen if the JWT cookie is missing or invalid — prevents unauthenticated API calls from ever firing. |
| **Docker Production Setup** | Multi-stage Dockerfile (bun + vite → nginx:alpine) with SPA-aware nginx config (no-cache for `config.js`, try-files fallback for client-side routing). |
| **Custom Study Columns** | `StudyInstanceUID` column (monospace, truncated, tooltip) and `LastUpdate` column (sortable datetime from Orthanc metadata). |
| **Column Resizing** | TanStack Table `columnResizeMode: 'onChange'` with `table-layout: fixed` for proper width enforcement. |
| **Label-Based Filtering** | Filter studies by Orthanc Labels via `/tools/find` with `Labels` + `LabelsConstraint: 'All'` (AND logic). Comma-separated input in the filter panel. |
| **RBAC Feature Flags** | Action buttons (download, send, modify, anonymize, delete, editLabels) are gated by `useFeature()` hooks. Feature flags set in `config.js` at deployment time. |
| **OHIF Viewer Integration** | "Open in OHIF" button on study detail — calls `POST /api/v1/pacs/viewer-session` to set an httpOnly cookie, then opens `/ohif/viewer?StudyInstanceUIDs=<uid>` in a new tab. |
| **Series Management** | Full series-level actions: download (ZIP archive), send to modality, modify, anonymize, delete. Sortable series table with multi-select and bulk download. |
| **Sortable DICOM Tag Browser** | All 4 columns (Tag, VR, Name, Value) are click-to-sort with arrow icons. |
| **Non-Secure Context Fix** | `crypto.randomUUID()` fallback for HTTP deployments (not just HTTPS/localhost). Without this fix, all API calls silently fail on plain HTTP. |
| **Accessibility** | Single H1 per page, `aria-label` on all search/filter inputs, semantic landmarks (`main`, `header`), no images without `alt` text. |
| **Playwright E2E Tests** | Production viewport tests (desktop 1280×800, mobile 375×812) with JWT cookie injection, DOM analysis, screenshots, and responsive layout validation. |
| **i18n: 9 Languages** | English, Spanish, French, German, Japanese, Chinese, **Russian**, **Turkish**, **Arabic**. |
| **Orthanc API Schema Alignment** | Type definitions match Orthanc 1.13.0 (API v31) — `DiskSize` as string, `ModifiedFrom`, `ExpectedNumberOfInstances`, `IndexInSeries`, `Capabilities`, etc. |
| **Custom Branding/Logo** | Configurable app name and logo via `branding.title` + `branding.logoUrl` in `config.js`. Logo appears in header, sidebar, and About dialog. Bundled default logo in `public/logo/`. |
| **Study/Series Merge** | Merge source studies into a target study, or migrate a series to a different study, via Orthanc `POST /studies/:id/merge`. Searchable source/target lists with same-SIUID highlighting. Optional source deletion after merge. |
| **Smart Multi-Token Search** | Client-side search with umlaut tolerance ("ü" matches "ue") and date pattern matching ("2908" matches "2026-08-29"). Combined queries like "Müller, CT, 29.08" work across all study fields. |
| **Live Activity Timeline** | Unified timeline merging audit events, live Orthanc jobs (3s polling), client-side jobs, and change events. Detail panel with action icons and navigation to related resources. |
| **Viewer Configuration** | Manage external viewer integrations (OHIF, Stone, VolView) in settings — add/edit/remove viewers, set default, enable/disable, with status indicators. |
| **DICOMweb Server Management** | Enhanced DICOMweb server config with auth type indicators (bearer/basic/oauth2/none) and external PACS QIDO/WADO configuration display. |
| **Embedded Theming** | White-labeling card for embedded deployments — app name, primary/accent colors, font presets, border radius, compact mode, sidebar/header visibility. Persists to `localStorage`. |
| **Remote Query/Retrieve** | C-FIND query and C-MOVE retrieve from remote modalities. C-ECHO connectivity test. Remote sources page with query/retrieve workflow. |
| **Study Sharing** | Share studies via Orthanc Shares plugin or instant viewer link. Share by email, copy link, expiration date, description. |
| **Worklists** | DICOM Modality Worklist Management — list, upload, delete worklists via dedicated page and API. |
| **Custom HTTP Buttons** | Configurable buttons that open arbitrary URLs with template tokens (`{studyId}`, `{patientId}`, `{accession}`, etc.). Persisted to `localStorage`. |
| **Add Series (Encapsulated)** | Upload PDF/JPEG/PNG/STL files as a new DICOM series within an existing study via Orthanc `/tools/create-dicom`. |
| **Modify In-Place / Duplicate** | Choose between `KeepSource: false` (modify in-place) or `KeepSource: true` (create duplicate) in the Modify dialog. |
| **External Viewers (Extended)** | VolView, MedDream, Weasis support in addition to OHIF and Stone. Configurable in Settings. |
| **Quick-Report** | Printable study summary dialog → browser print/PDF export. |
| **Custom Filename Templates** | Download with templated filenames (`{patientName}_{studyDate}_{accession}`). |
| **DICOM-DIR & NIfTI Export** | Download studies as ZIP with DICOMDIR index (`/media`), export instances as NIfTI. |
| **Audit Logs Page** | Global audit log viewer (`/audit-logs`) with search, filter, and JSON export. |
| **Column Show/Hide** | Toggle study list column visibility via configuration dropdown. |
| **Multi-Label AND/OR Toggle** | Switch between AND (`All`) and OR (`Any`) logic for label filtering. |
| **Touch-Optimized Controls** | 44px minimum touch target size on `pointer:coarse` devices. |
| **ApiView & Log Level** | Open Orthanc REST URL for any resource; change Orthanc log level from the UI. |
| **Mobile Card Views** | Study list and series table switch to responsive card layouts on mobile (< 768px) — no more horizontal scrolling. Cards show all key info with touch-friendly tap targets. |

---

## What It Does

Orthanc Explorer 2 (the official UI) is a Vue.js plugin compiled into C++ — updating the UI requires rebuilding the plugin, and it shows its age. OE3 is a pure React/TypeScript SPA that treats Orthanc's REST API as a headless backend. Deploy it as a Docker sidecar in a single `docker run` command: no backend server, no additional infrastructure, no config file editing.

**Key capabilities:**

- Browse studies by Patient Name, Patient ID, Accession Number, Study Date, Modality, Description, and **Orthanc Labels**
- **Smart search**: multi-token queries with umlaut tolerance and date pattern matching ("Müller, CT, 29.08")
- Upload DICOM files via drag-and-drop with per-file progress tracking
- Manage DICOM modalities and DICOMweb servers in-app (no config file edits, no restart)
- **Merge/migrate studies and series** via Orthanc `/merge` — consolidate duplicate studies or move series between studies
- Monitor jobs, ingestion activity, and system health in real time with a **unified activity timeline** (audit events + live Orthanc jobs)
- Anonymize, modify, send, download, and delete studies and series via an audit-backed action layer
- Open studies in OHIF, Stone Web Viewer, VolView, or any configured external viewer
- **Configure external viewers** in settings — add/edit/remove, set default, enable/disable
- **AuthGate**: SPA-level authentication check on boot — prevents unauthenticated API calls
- **Backend-proxy auth mode**: OE3 behind a JWT-authenticated reverse proxy with httpOnly cookies
- **RBAC feature flags**: selectively enable/disable UI actions via `config.js`
- **Custom branding**: configurable app name and logo via `branding` in `config.js`
- **Embedded theming**: white-label colors, fonts, border radius, compact mode for embedded deployments
- **Series-level operations**: download, send, modify, anonymize, delete, migrate — not just study-level
- **Sortable tables**: study list, series table, and DICOM tag browser all support click-to-sort
- **Multi-select bulk actions**: select multiple studies or series for bulk download/delete
- **Remote query/retrieve**: C-FIND/C-MOVE/C-ECHO from remote modalities, with a query/retrieve workflow UI
- **Study sharing**: share via Orthanc Shares plugin or instant viewer link, by email or clipboard
- **Worklists**: manage DICOM Modality Worklists (list, upload, delete)
- **Add encapsulated series**: upload PDF/JPEG/PNG/STL as DICOM series via `/tools/create-dicom`
- **Custom HTTP buttons**: configurable external links with template tokens
- **Quick-report**: printable study summary via browser print/PDF
- **Audit logs page**: global audit log viewer with search, filter, JSON export
- One build artifact runs in four modes: Docker sidecar, Orthanc plugin (`ServeFolders`), SMART on FHIR EHR embed, or **backend-proxy behind JWT auth**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite 5 (SPA, no SSR) |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix UI) |
| Server state | TanStack Query v5 |
| App state | Zustand v5 |
| Routing | React Router v6 |
| Validation | Zod |
| i18n | i18next (9 languages) |
| Testing | Vitest + React Testing Library (191 unit tests) |
| E2E Testing | Playwright (production viewport tests) |
| Backend | Orthanc DICOM server (external, via REST API) |

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Docker Compose)
- Node.js 18+ (or [Bun](https://bun.sh/))

### 1. Clone the repo

```bash
git clone https://github.com/emanuel901z-hue/orthanc-explorer-3-usable.git
cd orthanc-explorer-3-usable
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the local Docker stack

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts three services:

| Service | Port | Purpose |
|---------|------|---------|
| `orthanc` | 8042 (REST), 4242 (DICOM) | Orthanc DICOM server with PostgreSQL index |
| `azure-emulator` | 8080 | Azure DICOM Service Emulator (for OIDC auth testing) |
| `postgres` | 5432 | Shared database |

Wait for Orthanc to become healthy (10–30 seconds on first start while the PostgreSQL plugin initializes).

### 4. Load sample DICOM data (optional)

```bash
docker compose -f docker-compose.dev.yml --profile seed up seeder
```

Uploads `test-data/sample.dcm` to Orthanc. The seeder exits when done.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server proxies `/orthanc-proxy` → `http://localhost:8042`, so there are no CORS issues during development.

## Development Commands

```bash
# Start dev server (requires Docker stack running)
npm run dev

# Run unit tests (single pass, 191 tests)
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run src/lib/audit.test.ts

# Run Playwright production viewport tests (requires running deployment)
npx playwright test --config=e2e/prod/playwright.prod.config.ts

# Lint
npm run lint

# Type check (no emit)
npx tsc --noEmit

# Production build
npm run build
```

## Testing

### Unit Tests (Vitest)

191 unit tests covering the API layer, audit seam, health tracker, DICOM tag utilities, auth context, session store, and feature components.

```bash
npm run test          # Single pass
npm run test:watch    # Watch mode
```

### Playwright E2E Tests

Production viewport tests that run against a deployed OE3 instance. Tests cover:

- **Desktop (1280×800)**: App loads without console errors, study list renders with data, study detail page with sortable series table + statistics
- **Mobile (375×812 — iPhone X)**: No horizontal scroll, table in scrollable container, touch target analysis, navigation works
- **DOM Structure Analysis**: Landmarks, headings hierarchy, ARIA compliance, images without alt, inputs without labels

```bash
# Configure: e2e/prod/playwright.prod.config.ts
# Test file: e2e/prod/prod-viewport.spec.ts
npx playwright test --config=e2e/prod/playwright.prod.config.ts
```

Tests use JWT cookie injection (generate a token via `docker exec` on the backend container, set as a Playwright cookie) to authenticate against the deployed instance.

## Deployment

OE3 determines its behavior entirely from `window.__OE3_CONFIG__`, which is injected via `public/config.js` at container start. The same build artifact works in all modes.

### Docker sidecar (alongside Orthanc)

```yaml
services:
  orthanc:
    image: orthancteam/orthanc:latest-full
    ports:
      - "8042:8042"

  orthanc-ui:
    image: rhavekost/orthanc-explorer-3:latest
    ports:
      - "3000:80"
    environment:
      ORTHANC_URL: "http://orthanc:8042"
      AUTH_MODE: "none"   # none | basic | oidc | smart
      TITLE: "My Orthanc"
```

### Docker behind a JWT backend proxy (fork-specific)

This is the production mode used by this fork. OE3 runs as a static nginx container; all Orthanc API calls go through a backend proxy that enforces JWT auth, MFA, and RBAC. The backend sets an httpOnly cookie (8h PACS token) via a `/viewer-session` or `/oe3-ui` endpoint.

```yaml
services:
  oe3:
    build:
      context: .
      dockerfile: Dockerfile
    # No ORTHANC_URL env — config.js is baked in at build time
    # nginx serves static assets; API calls go to /api/v1/pacs/orthanc/...
    # via the reverse proxy in the host nginx
```

`public/config.prod.js` (example):

```javascript
window.__OE3_CONFIG__ = {
  orthancUrl: "/api/v1/pacs/orthanc",  // backend proxy path
  authMode: "none",                     // proxy handles auth
  features: {
    enableUpload: true,
    enableModalityConfig: true,
    enableAnonymize: false,             // handled by backend with audit trail
    enableDelete: false,
    enableModify: false,
    enableSendTo: false,
  },
  branding: {
    title: "Orthanc Explorer 3",
    logoUrl: "/oe3/logo/oe3-logo-128.png",  // optional — bundled default if omitted
  },
};
```

**Auth flow:**

1. User logs into the host application (JWT + MFA)
2. Host app calls `POST /api/v1/pacs/viewer-session` → backend sets httpOnly cookie
3. Host app redirects to `GET /api/v1/pacs/oe3-ui` → backend confirms cookie, 302 → `/oe3/`
4. OE3 SPA loads → **AuthGate** calls `GET /api/v1/pacs/oe3-me` to verify the cookie
5. If authenticated: SPA renders, all API calls include the cookie via `credentials: 'include'`
6. If not authenticated: SPA shows a "login required" screen — no API calls are made
7. Backend proxy validates cookie, injects Orthanc admin credentials, forwards to Orthanc

### Auth modes

| `authMode` | Description |
|------------|-------------|
| `none` | No auth — direct Orthanc access (dev / internal lab) **or backend-proxy mode** (AuthGate still checks `/oe3-me`) |
| `basic` | HTTP Basic auth forwarded to Orthanc |
| `oidc` | Bearer token via OIDC/OAuth2 (e.g., Azure DICOM Service) |
| `smart` | SMART on FHIR EHR launch with patient context |

### Feature flags (RBAC)

Feature flags in `config.js` control which UI actions are visible. This is useful when OE3 runs behind a proxy that already handles dangerous operations (delete, anonymize) with proper audit trails.

| Flag | Default | Description |
|------|---------|-------------|
| `enableUpload` | `true` | Show upload page and upload buttons |
| `enableModalityConfig` | `true` | Show modality/DICOMweb management in settings |
| `enableAnonymize` | `false` | Show anonymize button on study detail |
| `enableDelete` | `false` | Show delete buttons (bulk + detail) |
| `enableModify` | `false` | Show modify button on study detail |
| `enableSendTo` | `false` | Show send-to-modality buttons |
| `enableDownload` | `true` | Show download buttons |
| `enableEditLabels` | `true` | Show label editing buttons |

### Plugin mode (Orthanc `ServeFolders`)

Build the SPA (`npm run build`), copy `dist/` into Orthanc's `ServeFolders` directory, and set `ORTHANC_URL=""` in `config.js` (or omit it — same-origin requests need no base URL).

## Architecture

OE3 uses a strict four-layer architecture to keep healthcare concerns (audit, PHI, auth) in exactly one place each:

```
features/*     React components + TanStack Query hooks
    ↓
actions/*      Audit seam — every write emits AuditEvent before/after
    ↓
api/*          Typed Orthanc endpoint wrappers (pure functions, no side effects)
    ↓
lib/client.ts  Transport — auth headers, correlation IDs, PHI-safe error handling
```

**Auth flow (backend-proxy mode):**

```
AppProviders
    ↓
AuthProvider → fetch /oe3-me → sets isAuthenticated
    ↓
AuthGate → shows login screen if !isAuthenticated
    ↓
BrowserRouter (basename="/oe3")
    ↓
AppLayout (sidebar + header + UserBadge)
    ↓
StudyListPage / StudyDetailPage / SeriesDetailPage / ...
```

**PHI hygiene rules enforced in code:**
- PHI-bearing searches use `POST /tools/find` — never GET with query strings in URLs or browser history
- URL parameters carry only Orthanc UUIDs, never patient names or MRNs
- `localStorage` is allow-listed — session data containing PHI is memory-only and cleared on logout
- The logger (`lib/logger.ts`) scrubs identifiers before any output

**Cross-cutting seams** (each is one module, swap the backing without changing call sites):

| Module | v0.1 behavior | Future |
|--------|---------------|--------|
| `lib/audit.ts` | Logs `AuditEvent` to console | POST to Orthanc ATNA plugin |
| `lib/health.ts` | In-memory tracker + degradation banner | Multi-endpoint SLO surfacing |
| `lib/logger.ts` | Console + allowlist field redaction | Structured log collector |
| `lib/correlation.ts` | UUIDv4 per request via `X-Request-Id` (with non-secure context fallback) | Threaded into error toasts |

### Non-Secure Context Support

`lib/correlation.ts` generates UUIDv4 correlation IDs for the `X-Request-Id` header. `crypto.randomUUID()` is only available in **secure contexts** (HTTPS or `localhost`). On internal HTTP deployments (e.g. `http://10.0.0.1:8080`), it is `undefined` and throws a `TypeError` — which is silently caught by `orthancFetch`'s catch block, causing **all API calls to fail**.

The fix provides a fallback chain:
1. `crypto.randomUUID()` (secure contexts — HTTPS, localhost)
2. `crypto.getRandomValues()` with manual UUIDv4 formatting (all contexts)
3. `Math.random()` as last resort (not cryptographically secure, but sufficient for correlation IDs)

## Project Layout

```
orthanc-explorer-3-usable/
├── Dockerfile                 # Multi-stage: bun + vite → nginx:alpine
├── docker/oe3-nginx.conf      # SPA-aware nginx config
├── docker-compose.dev.yml     # Full local dev stack
├── e2e/prod/                  # Playwright production viewport tests
│   ├── playwright.prod.config.ts
│   ├── prod-viewport.spec.ts
│   └── screenshots/           # Test screenshots (desktop + mobile)
├── public/
│   ├── config.js              # Dev placeholder — replaced at container start
│   ├── config.prod.js         # Example production config (backend-proxy mode)
│   └── logo/                  # Bundled logo assets (128/256/32/64px + favicon)
└── src/
    ├── app/
    │   ├── layout/            # AppLayout, AppSidebar, UserBadge
    │   └── providers/         # AppProviders, AuthProvider, AuthGate, ErrorBoundary
    ├── config/
    │   ├── runtime.ts         # Boot config loader (Zod schema, window.__OE3_CONFIG__)
    │   └── features.ts        # Layered feature flag resolver (useFeature hook)
    ├── lib/                   # Cross-cutting singletons (client, health, logger, audit, errors, correlation, smart-search)
    ├── api/                   # Typed Orthanc endpoint wrappers (one file per resource)
    ├── actions/               # Audit seam — write actions only (delete, send, download, merge, modify, anonymize, upload, labels)
    ├── features/              # React UI grouped by domain
    │   ├── studies/           # StudyListPage (smart search), StudyDetailPage (sortable series table, multi-select, merge/migrate)
    │   ├── series/            # SeriesDetailPage (download, send, modify, delete, migrate)
    │   ├── instances/         # InstanceDetailPage, DicomTagBrowser (sortable columns)
    │   ├── viewer/            # Cornerstone3D viewer integration
    │   ├── upload/            # Drag-and-drop DICOM upload
    │   ├── activity/          # Unified activity timeline (audit events + live Orthanc jobs)
    │   └── settings/          # Modality + DICOMweb + viewer config + embedded theming + system info
    ├── i18n/
    │   └── locales/           # 9 languages: en, es, fr, de, ja, zh, ru, tr, ar
    ├── store/                 # Zustand stores (ui, session, upload, jobs, tabs)
    └── pages/                 # Top-level route targets
```

## Internationalization

9 languages with full translation of all UI strings. DICOM terms (Study, Series, Instance, Modality, etc.) are kept in English across all locales for clinical consistency.

| Language | Code | Status |
|----------|------|--------|
| English | `en` | Complete (source language) |
| Spanish | `es` | Complete |
| French | `fr` | Complete |
| German | `de` | Complete |
| Japanese | `ja` | Complete |
| Chinese | `zh` | Complete |
| Russian | `ru` | Complete |
| Turkish | `tr` | Complete |
| Arabic | `ar` | Complete (RTL) |

## Contributing

This fork is community-maintained. Contributions are welcome.

```bash
git clone https://github.com/emanuel901z-hue/orthanc-explorer-3-usable.git
cd orthanc-explorer-3-usable
npm install
docker compose -f docker-compose.dev.yml up -d
npm run dev
```

Tests run with `npm run test`. Please open an issue before starting a large change.

Architectural context lives in [`docs/plans/`](docs/plans/). Fork-specific changes are documented in [`docs/fork-changelog.md`](docs/fork-changelog.md).

### Upstream

This fork tracks the upstream at [rhavekost/orthanc-explorer-3](https://github.com/rhavekost/orthanc-explorer-3). Fork-specific changes are documented in [`docs/fork-changelog.md`](docs/fork-changelog.md).

## License

MIT — see [LICENSE](LICENSE)
