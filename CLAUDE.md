# Orthanc Explorer 3 — Usable Fork

A React SPA wired to a local Orthanc DICOM server with healthcare-grade architecture: typed API layer, audit seam, PHI-safe logging, runtime deployment mode config, and global health tracking.

> **Fork of [rhavekost/orthanc-explorer-3](https://github.com/rhavekost/orthanc-explorer-3)** with production enhancements for backend-proxy auth mode, RBAC feature flags, custom columns, label filtering, OHIF integration, and 9-language i18n. See [docs/fork-changelog.md](docs/fork-changelog.md) for details.

## Commands

### Development
```bash
# Install dependencies
npm install

# Start the local Docker stack (Orthanc + Azure emulator + Postgres)
docker compose -f docker-compose.dev.yml up -d

# Seed sample DICOM data (optional, requires stack running)
docker compose -f docker-compose.dev.yml --profile seed up seeder

# Start dev server (app at http://localhost:5173)
npm run dev

# Preview production build locally
npm run preview
```

### Testing
```bash
# Run all tests (single pass)
npm run test

# Watch mode
npm run test:watch

# Run a single test file
npx vitest run src/lib/audit.test.ts
```

### Build & Quality
```bash
# Production build
npm run build

# Development build (with source maps)
npm run build:dev

# Lint
npm run lint

# TypeScript type check (no emit)
npx tsc --noEmit
```

## Architecture

- `src/lib/` — cross-cutting singletons: `client`, `health`, `logger`, `audit`, `errors`, `correlation`
- `src/api/` — typed Orthanc REST endpoint wrappers, one file per resource (studies, series, instances, modalities, peers, jobs, etc.)
- `src/actions/` — audit seam: every write (delete, send, anonymize, modify, upload) emits an `AuditEvent` before/after execution
- `src/features/` — React UI components and hooks grouped by domain (studies, series, instances, viewer, upload, audit, settings, etc.)
- `src/store/` — Zustand stores for global UI, sessions, uploads, jobs, tabs, and audit
- `src/config/` — runtime config: `runtime.ts` parses `window.__OE3_CONFIG__` via Zod at boot; `features.ts` for feature flags
- `src/pages/` — top-level route pages
- Entry point: `src/main.tsx` — calls `loadConfig()` before mounting React; shows a PHI-safe error screen on config failure
- Runtime config: `public/config.js` — replaced at deploy time; sets `orthancUrl`, `authMode`, `features`, `branding`
- Dev proxy: `vite.config.ts` rewrites `/orthanc-proxy → http://localhost:8042` to avoid CORS in dev

## Tech Stack

- **Language:** TypeScript 5.8
- **Framework:** React 18 + Vite 5 (SPA, no SSR)
- **Routing:** React Router DOM v6
- **State:** Zustand v5 (global stores) + TanStack Query v5 (server state)
- **Styling:** Tailwind CSS v3 + shadcn/ui (Radix UI primitives)
- **Validation:** Zod (runtime config parsing and input validation)
- **i18n:** i18next + react-i18next
- **Testing:** Vitest + React Testing Library + jsdom
- **Backend:** Orthanc DICOM server (Docker) with PostgreSQL index + DICOMweb plugin
- **Emulator:** Azure DICOM Service Emulator (for `authMode: "oidc"` dev testing)

## Local Services (Docker)

| Service | Port | Purpose |
|---------|------|---------|
| `orthanc` | 8042 (HTTP), 4242 (DICOM) | Orthanc DICOM server |
| `azure-emulator` | 8080 | Azure DICOM Service Emulator |
| `postgres` | 5432 | Shared database (orthanc + dicom_emulator schemas) |

## Deployment Modes

Controlled by `window.__OE3_CONFIG__.authMode` in `public/config.js`:

| `authMode` | Description |
|------------|-------------|
| `"none"` | No auth — direct Orthanc plugin access (dev default) **or backend-proxy mode** (OE3 behind a JWT reverse proxy; `orthancUrl` points to proxy path, cookies flow via `credentials: 'include'`) |
| `"basic"` | HTTP Basic auth |
| `"oidc"` | OIDC/OAuth2 via Azure DICOM emulator |
| `"smart"` | SMART-on-FHIR launch |

### Backend-Proxy Auth Mode (fork-specific)

When `authMode: "none"` and `orthancUrl` points to a backend proxy (e.g. `/api/v1/pacs/orthanc`), OE3 acts as a pure SPA with no auth headers. The backend proxy:
- Validates JWT cookies (httpOnly, set via `/viewer-session` or `/oe3-ui` endpoint)
- Injects Orthanc admin credentials server-side
- Enforces RBAC and audit trails

OE3's `lib/client.ts` uses `credentials: 'include'` so cookies are sent automatically on all API calls.

## Feature Flags (RBAC)

`src/config/features.ts` provides `useFeature(key)` — a layered resolver that checks:
1. `config.js` feature flags (deployment-time)
2. User profile permissions (Phase 2 — not yet implemented)
3. SMART-on-FHIR scopes (Phase 2 — not yet implemented)

UI buttons for download, send, modify, anonymize, delete, and editLabels are gated by `useFeature()`. Set flags in `config.js`:

```javascript
features: {
  enableUpload: true,
  enableModalityConfig: true,
  enableAnonymize: false,  // handled by backend with audit trail
  enableDelete: false,
  enableModify: false,
  enableSendTo: false,
}
```

## Code Style & Conventions

- All imports use the `@/` alias (maps to `src/`)
- Each Orthanc resource type has a dedicated file in `src/api/` — follow the existing pattern for new endpoints
- Write operations in `src/actions/` must emit `AuditEvent` before and after; never write directly from feature components
- Tests live alongside source files: `foo.ts` → `foo.test.ts`
- No `console.log` in source — use `src/lib/logger.ts` (PHI-safe)

## Key Files

| File | Purpose |
|------|---------|
| `public/config.js` | Runtime config injected at deploy — dev placeholder only; replaced in production |
| `public/config.prod.js` | Example production config for backend-proxy auth mode |
| `src/config/runtime.ts` | Zod schema + `loadConfig()` / `getConfig()` — parsed once at boot |
| `src/config/features.ts` | Feature flag resolver + `useFeature()` hook (RBAC) |
| `src/lib/client.ts` | Central HTTP client for all Orthanc requests (`credentials: 'include'`) |
| `src/lib/audit.ts` | AuditEvent emitter used by all write actions |
| `src/lib/health.ts` | Global health tracking singleton |
| `src/features/studies/pages/StudyListPage.tsx` | Study list with custom columns, resizing, label filter |
| `src/features/studies/pages/StudyDetailPage.tsx` | Study detail with OHIF button, RBAC-gated actions, sortable/filterable series table with multi-select bulk download |
| `src/features/series/pages/SeriesDetailPage.tsx` | Series detail with functional download/send/delete, instance grid/table view |
| `src/features/studies/components/DicomTagBrowser.tsx` | DICOM tag browser with search, sortable columns, inline editing |
| `src/shared/api/orthanc-study-repository.ts` | Repository with label-based `/tools/find` filtering, RequestedTags for computed tags |
| `src/api/series.ts` | Series API: get, getInstances, getSharedTags, delete, archive, modify, anonymize, sendToModality |
| `src/api/tools.ts` | Tools API: lookup, createArchive (multi-resource ZIP) |
| `src/i18n/locales/` | 9 languages: en, es, fr, de, ja, zh, ru, tr, ar |
| `Dockerfile` | Multi-stage build (bun + vite → nginx:alpine) |
| `docker/oe3-nginx.conf` | SPA-aware nginx config (no-cache for config.js, try-files fallback) |
| `docker-compose.dev.yml` | Full local dev stack definition |
| `docker/postgres-init.sh` | Creates the `dicom_emulator` database on first start |
| `docs/plans/` | Architecture and smoke-test planning documents |
| `docs/fork-changelog.md` | Fork-specific changes vs upstream |

## Important Constraints

- Never edit `public/config.js` for production values — it is a dev placeholder; production config is injected by the deployment target
- The `oauth-plugin` service in `docker-compose.dev.yml` is disabled by default (requires `--profile oauth`) and has a known TODO before it can be used — see inline comments
- Dev Postgres credentials (`dev`/`dev`) are hardcoded in `docker-compose.dev.yml` — never use these in production
- `src/api/` files must not log PHI; route through `src/lib/logger.ts` which scrubs identifiers
