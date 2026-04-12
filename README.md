# Orthanc Explorer 3

A React SPA wired to a local [Orthanc](https://www.orthanc-server.com/) DICOM server with healthcare-grade architecture: typed API layer, audit seam, PHI-safe logging, runtime deployment mode config, and global health tracking.

## Development

### Prerequisites

- Docker + Docker Compose
- Node.js 18+ (or Bun)

### 1. Start the local stack

```bash
docker compose -f docker-compose.dev.yml up -d
```

Three services start:
- **orthanc** — Orthanc DICOM server with PostgreSQL index (port 8042)
- **azure-emulator** — Azure DICOM Service Emulator (port 8080)
- **postgres** — shared database

### 2. Seed sample data (optional)

```bash
docker compose -f docker-compose.dev.yml --profile seed up seeder
```

Uploads `test-data/sample.dcm` to Orthanc.

### 3. Run the dev server

```bash
npm run dev
# or: bun run dev
```

App loads at `http://localhost:5173`.

### 4. Run tests

```bash
npm run test
```

### 5. Lint + build

```bash
npm run lint
npm run build
```

## Architecture

See [`docs/plans/2026-04-11-initial-architecture-design.md`](docs/plans/2026-04-11-initial-architecture-design.md) for the full design.

Key layers:
- `src/lib/` — cross-cutting singletons: `client`, `health`, `logger`, `audit`, `errors`, `correlation`
- `src/api/` — typed Orthanc endpoint wrappers (no PHI in URLs)
- `src/actions/` — audit seam: every write emits an `AuditEvent` before/after
- `src/features/` — React UI components and hooks (data from real API)
- `src/config/runtime.ts` — runtime config via `window.__OE3_CONFIG__`

## Smoke Testing

See [`docs/plans/2026-04-11-v0.1-smoke-checklist.md`](docs/plans/2026-04-11-v0.1-smoke-checklist.md) for the end-to-end smoke checklist.

## Deployment Modes

Set via `window.__OE3_CONFIG__` at runtime:

| `authMode` | Description |
|---|---|
| `"none"` | No auth — direct Orthanc plugin access |
| `"basic"` | HTTP Basic auth |
| `"oidc"` | OIDC/OAuth2 via Azure DICOM emulator |
| `"smart"` | SMART-on-FHIR launch |
