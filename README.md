# Orthanc Explorer 3

> A modern React admin UI for [Orthanc](https://www.orthanc-server.com/) — the open-source DICOM server. Runs as a Docker sidecar with no backend server required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

**Disclaimer:** Orthanc Explorer 3 is intended for informational, research, and administrative purposes. It is not FDA cleared and is not intended for primary diagnostic interpretation of medical images. Organizations requiring FDA-cleared diagnostic viewing should use an appropriately cleared viewer application.

---

## What It Does

Orthanc Explorer 2 (the official UI) is a Vue.js plugin compiled into C++ — updating the UI requires rebuilding the plugin, and it shows its age. OE3 is a pure React/TypeScript SPA that treats Orthanc's REST API as a headless backend. Deploy it as a Docker sidecar in a single `docker run` command: no backend server, no additional infrastructure, no config file editing.

**Key capabilities:**

- Browse studies by Patient Name, Patient ID, Accession Number, Study Date, Modality, and Description
- Upload DICOM files via drag-and-drop with per-file progress tracking
- Manage DICOM modalities and DICOMweb servers in-app (no config file edits, no restart)
- Monitor jobs, ingestion activity, and system health in real time
- Anonymize, modify, send, download, and delete studies via an audit-backed action layer
- Open studies in OHIF, Stone Web Viewer, VolView, or any configured external viewer
- Adaptive auth display: shows identity when Basic auth, OIDC, or SMART on FHIR context is present; hides when auth is absent
- One build artifact runs in three modes: Docker sidecar, Orthanc plugin (`ServeFolders`), or SMART on FHIR EHR embed

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
| i18n | i18next |
| Testing | Vitest + React Testing Library |
| Backend | Orthanc DICOM server (external, via REST API) |

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Docker Compose)
- Node.js 18+ (or [Bun](https://bun.sh/))

### 1. Clone the repo

```bash
git clone https://github.com/rhavekost/orthanc-explorer-3.git
cd orthanc-explorer-3
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

# Run tests (single pass)
npm run test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run src/lib/audit.test.ts

# Lint
npm run lint

# Type check (no emit)
npx tsc --noEmit

# Production build
npm run build
```

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

### Auth modes

| `authMode` | Description |
|------------|-------------|
| `none` | No auth — direct Orthanc access (dev / internal lab) |
| `basic` | HTTP Basic auth forwarded to Orthanc |
| `oidc` | Bearer token via OIDC/OAuth2 (e.g., Azure DICOM Service) |
| `smart` | SMART on FHIR EHR launch with patient context |

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
| `lib/correlation.ts` | UUIDv4 per request via `X-Request-Id` | Threaded into error toasts |

## Project Layout

```
orthanc-explorer-3/
├── docker-compose.dev.yml    # Full local dev stack
├── test-data/                # Sample DICOM file for seeder
├── public/
│   └── config.js             # Dev placeholder — replaced at container start
└── src/
    ├── config/
    │   ├── runtime.ts        # Boot config loader (Zod schema, window.__OE3_CONFIG__)
    │   └── features.ts       # Layered feature flag resolver
    ├── lib/                  # Cross-cutting singletons (client, health, logger, audit, errors)
    ├── api/                  # Typed Orthanc endpoint wrappers (one file per resource)
    ├── actions/              # Audit seam — write actions only
    ├── features/             # React UI grouped by domain
    ├── store/                # Zustand stores (ui, session, upload, jobs, tabs)
    └── pages/                # Top-level route targets
```

## Contributing

OE3 is in active development. The Orthanc forum explicitly asked for a community-maintained modern UI — contributions are welcome.

```bash
git clone https://github.com/rhavekost/orthanc-explorer-3.git
cd orthanc-explorer-3
npm install
docker compose -f docker-compose.dev.yml up -d
npm run dev
```

Tests run with `npm run test`. Please open an issue before starting a large change.

Architectural context lives in [`docs/plans/2026-04-11-initial-architecture-design.md`](docs/plans/2026-04-11-initial-architecture-design.md).

## License

MIT — see [LICENSE](LICENSE)
