# Orthanc Explorer 3

A React SPA wired to a local Orthanc DICOM server with healthcare-grade architecture: typed API layer, audit seam, PHI-safe logging, runtime deployment mode config, and global health tracking.

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
| `"none"` | No auth — direct Orthanc plugin access (dev default) |
| `"basic"` | HTTP Basic auth |
| `"oidc"` | OIDC/OAuth2 via Azure DICOM emulator |
| `"smart"` | SMART-on-FHIR launch |

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
| `src/config/runtime.ts` | Zod schema + `loadConfig()` / `getConfig()` — parsed once at boot |
| `src/lib/client.ts` | Central HTTP client for all Orthanc requests |
| `src/lib/audit.ts` | AuditEvent emitter used by all write actions |
| `src/lib/health.ts` | Global health tracking singleton |
| `docker-compose.dev.yml` | Full local dev stack definition |
| `docker/postgres-init.sh` | Creates the `dicom_emulator` database on first start |
| `docs/plans/` | Architecture and smoke-test planning documents |

## Important Constraints

- Never edit `public/config.js` for production values — it is a dev placeholder; production config is injected by the deployment target
- The `oauth-plugin` service in `docker-compose.dev.yml` is disabled by default (requires `--profile oauth`) and has a known TODO before it can be used — see inline comments
- Dev Postgres credentials (`dev`/`dev`) are hardcoded in `docker-compose.dev.yml` — never use these in production
- `src/api/` files must not log PHI; route through `src/lib/logger.ts` which scrubs identifiers
