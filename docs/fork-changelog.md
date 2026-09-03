# Fork Changelog

Changes in this fork (`emanuel901z-hue/orthanc-explorer-3-usable`) vs upstream (`rhavekost/orthanc-explorer-3`).

---

## v1.0.0 — Production Deployment Enhancements (2026-09-03)

### Docker + Nginx

- **Dockerfile**: Multi-stage build (bun + vite → nginx:alpine). Production-ready container with static asset serving.
- **docker/oe3-nginx.conf**: SPA-aware nginx config — `try_files` fallback for client-side routing, `no-cache` headers for `config.js` (so runtime config is always fresh).
- **public/config.prod.js**: Example production config for backend-proxy auth mode (`orthancUrl: "/api/v1/pacs/orthanc"`, `authMode: "none"`, feature flags).

### Study List (StudyListPage.tsx)

- **StudyInstanceUID column**: Monospace font, truncated with ellipsis, tooltip on hover, 280px default width. Useful for correlating with external systems (OHIF, DICOMweb QIDO-RS).
- **LastUpdate column**: Sortable, formatted datetime parsed from Orthanc's `LastUpdate` field (`YYYYMMDDTHHmmss` format).
- **Column resizing**: TanStack Table `columnResizeMode: 'onChange'` with `ColumnSizingState` persisted in component state. `table-layout: fixed` on the table element ensures column widths are enforced.
- **Label filter input**: Comma-separated input in the filter panel. Sends `Labels` + `LabelsConstraint: 'All'` to Orthanc `/tools/find` (AND logic — studies must have all specified labels).

### Study Detail (StudyDetailPage.tsx)

- **"Open in OHIF" button**: Calls `POST /api/v1/pacs/viewer-session` (sets httpOnly cookie with 8h PACS token), then opens `/ohif/viewer?StudyInstanceUIDs=<uid>` in a new tab. Works with any OHIF deployment that shares the same cookie domain.
- **RBAC-gated action buttons**: Download, Send, Modify, Anonymize, and Delete buttons are conditionally rendered based on `useFeature()` hooks. Feature flags set in `config.js` at deployment time.

### RBAC Feature Flags (config/features.ts)

Wired `useFeature()` hooks to UI components:

| Feature Key | UI Elements Gated |
|-------------|-------------------|
| `download` | Download buttons (study list bulk + study detail) |
| `send` | Send-to-modality buttons (study list bulk + study detail) |
| `modify` | Modify button (study detail) |
| `anonymize` | Anonymize button (study detail) |
| `delete` | Delete buttons (study list bulk + study detail) |
| `editLabels` | Label editing button (study list bulk) |
| `upload` | Upload page visibility |
| `modalityManagement` | Modality/DICOMweb management in settings |

### i18n

- **Russian (ru.json)**: 144 keys, full translation. DICOM terms kept in English.
- **Turkish (tr.json)**: 144 keys, full translation. DICOM terms kept in English.
- **Arabic (ar.json)**: 144 keys, full translation. DICOM terms kept in English.
- **German (de.json)**: Added `studyList` section (columns, filters, pagination, status, actions) — was missing in upstream.
- **English (en.json)**: Added `studyList` section + `openInOhif` key.
- **i18n/index.ts**: Registered 3 new locales (ru, tr, ar) in `SUPPORTED_LANGUAGES` and `resources`.

Total: 9 languages (en, es, fr, de, ja, zh, ru, tr, ar).

### API Layer

- **orthanc-study-repository.ts**: `findAll()` now accepts `labels?: string[]` in `StudyFilters`. When provided, sends `Labels` array + `LabelsConstraint: 'All'` to Orthanc `/tools/find` (native server-side filtering, AND logic).
- **dicom.ts (types)**: `StudyFilters` interface extended with `labels?: string[]`.

### TypeScript Config

- **tsconfig.app.json**: Removed `types: ["vitest/globals"]` — test files explicitly import from `vitest` (e.g. `import { describe, it, expect } from 'vitest'`), so the global type reference was unnecessary and caused lint errors when vitest was not installed locally.

### Files Changed

```
Modified:
  .gitignore
  src/features/studies/pages/StudyDetailPage.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/i18n/index.ts
  src/i18n/locales/de.json
  src/i18n/locales/en.json
  src/shared/api/orthanc-study-repository.ts
  src/shared/types/dicom.ts
  tsconfig.app.json

Added:
  Dockerfile
  docker/oe3-nginx.conf
  public/config.prod.js
  src/i18n/locales/ar.json
  src/i18n/locales/ru.json
  src/i18n/locales/tr.json
  docs/fork-changelog.md
```

---

## v1.1.0 — Orthanc API Schema, Mobile, Series Management & Endpoint Matching (2026-09-03)

### Orthanc REST API Schema Alignment (Orthanc 1.13.0, API v31)

- **OrthancStudy type**: Added `ModifiedFrom?: string | null` (Orthanc 1.13.0 returns this field).
- **OrthancSeries type**: Added `ExpectedNumberOfInstances`, `IsStable`, `Labels`, `LastUpdate`, `ModifiedFrom`, `Status` — all returned by Orthanc 1.13.0 but missing from the type definition.
- **OrthancInstance type**: Added `FileUuid`, `IndexInSeries`, `Labels`, `ModifiedFrom` — `IndexInSeries` is needed for instance sorting.
- **OrthancSystem type**: Added `HasLabels?: boolean` and `Capabilities?: Record<string, boolean>` for runtime feature detection (Orthanc 1.13.0+).
- **OrthancStats type**: Added `TotalDiskSizeMB`, `TotalUncompressedSize`, `TotalUncompressedSizeMB`. Fixed `TotalDiskSize` type (string, not number — Orthanc returns bytes as string).
- **StudyStatistics type**: Fixed `DiskSize` type from `number` to `string` (Runtime TypeError when displaying). Added `CountSeries`, `DiskSizeMB`, `UncompressedSize`, `UncompressedSizeMB`.
- **ChangesResponse type**: Added `First` field (Orthanc 1.13.0 returns oldest sequence number).
- **findById()**: Now converts `DiskSize` string→number via `Number(stats.DiskSize)`, uses `CountSeries` from statistics.

### Series Management

- **Series API**: Added `archive()`, `modify()`, `anonymize()`, `sendToModality()` to `seriesApi` — previously only `get`, `getInstances`, `getSharedTags`, `delete` were available.
- **Tools API**: Added `createArchive()` — `POST /tools/create-archive` for multi-resource ZIP downloads.
- **downloadSeriesAction**: New audit-seam wrapper for series archive downloads.
- **sendSeriesAction**: New audit-seam wrapper for sending series to DICOM modalities.
- **SeriesDetailPage**: Download, Send, Delete buttons now functional (were placeholder audit-only). Delete navigates back to study after success. All buttons clearly labeled "Series" (not "Study").
- **StudyDetailPage Series Table**: Sortable columns (#, Modality, Description, Images) with click-to-sort and arrow icons. Filter search box for real-time series filtering by description, modality, series number, or SeriesInstanceUID.
- **Multi-Select Series**: Checkbox column in series table with "Select All" header. Bulk action bar shows selected count + "Download N as ZIP" button using `POST /tools/create-archive`.

### Preview 415 Fix

- **useInstancePreview**: Catches 415 (Unsupported Media Type) and returns `null` instead of erroring. SR/PR documents (Structured Reports without pixel data) now show a neutral placeholder instead of console errors.

### DICOM Tag Browser

- **Sortable columns**: All 4 columns (Tag, VR, Name, Value) are now click-to-sort with ArrowUp/ArrowDown/ArrowUpDown icons. Only top-level tags are sorted; SQ children maintain their original order.

### Mobile/Responsive

- **StudyDetailPage**: Series table has `minWidth: 700px` with `overflow-auto` for horizontal scroll on mobile. Filter search and view toggle stack vertically on mobile (`flex-col sm:flex-row`). Bulk action bar wraps on mobile.
- **SeriesDetailPage**: Responsive padding (`p-4 md:p-6`).

### API Documentation

- **All API files** (`src/api/*.ts`): Every `orthancFetch` call now has a JSDoc comment describing the HTTP method, endpoint path, request body, and response shape.

### Frontend-Backend Endpoint Matching (GAP Check)

- **Gap check `oe3.py`**: Added 4 new checks (31-34) for bidirectional frontend-backend API endpoint matching:
  1. Catch-all `/orthanc` proxy exists with ADMIN+SUPERADMIN+domain_uuid='system' + correct pathRewrite
  2. Backend OE3-specific routes (`/oe3-me`, `/viewer-session`) are used by the frontend
  3. No direct `localhost:8042` URLs in production source (proxy bypass detection)
  4. Cornerstone DICOMweb paths use runtime config (`getDicomWebUrl()`), not hardcoded URLs
- **Reference endpoint list**: 44 Orthanc REST endpoints documented in `OE3_FRONTEND_ENDPOINTS` set for orphan detection.

### Files Changed

```
Modified:
  src/api/changes.ts
  src/api/dicomWebServers.ts
  src/api/instances.ts
  src/api/modalities.ts
  src/api/peers.ts
  src/api/series.ts
  src/api/studies.ts
  src/api/system.ts
  src/api/tools.ts
  src/app/providers/auth-context.test.tsx
  src/app/providers/auth-context.tsx
  src/features/studies/components/DicomTagBrowser.tsx
  src/features/studies/pages/StudyDetailPage.tsx
  src/features/studies/pages/StudyDetailPage.test.tsx
  src/features/studies/hooks/use-studies.ts
  src/features/series/pages/SeriesDetailPage.tsx
  src/shared/api/orthanc-study-repository.ts

Added:
  src/actions/downloadSeries.ts
  src/actions/sendSeries.ts
```

---

## v1.2.0 — AuthGate, Non-Secure Context Fix, Accessibility & Playwright E2E (2026-09-03)

### AuthGate (app/providers/AuthGate.tsx)

- **New component**: SPA-level auth gate that wraps the entire app. Calls `/oe3-me` on boot via `AuthProvider`; if the JWT cookie is missing or invalid, shows a "login required" screen instead of the UI.
- **App.tsx**: Wrapped with `<AuthGate>` — no API calls fire until authentication is confirmed.
- **BrowserRouter**: Added `basename="/oe3"` for sub-path deployment behind a reverse proxy.
- **UserBadge.tsx**: Replaced hardcoded demo user with real `useAuth()` context — shows the authenticated user's display name, initials, and roles from `/oe3-me`.

### Non-Secure Context Fix (lib/correlation.ts)

- **Critical bug**: `crypto.randomUUID()` is only available in secure contexts (HTTPS or `localhost`). On internal HTTP deployments (e.g. `http://10.0.1.46:3080`), it is `undefined` and throws a `TypeError` — silently caught by `orthancFetch`'s catch block, causing **all API calls to fail**. OE3 showed "0 studies found" despite studies existing in Orthanc.
- **Fix**: Fallback chain — `crypto.randomUUID()` → `crypto.getRandomValues()` with manual UUIDv4 formatting → `Math.random()` as last resort.

### Accessibility

- **Duplicate H1 fix**: Changed `<h1>` to `<span>` in `AppLayout.tsx` header — was creating 2 H1 tags per page (header + page title). Now only one H1 per page for SEO/screen readers.
- **aria-label on search inputs**: Added `aria-label` to the patient search input in `StudyListPage.tsx` and the series filter input in `StudyDetailPage.tsx` — screen readers now announce the purpose of these inputs.

### Playwright E2E Tests (e2e/prod/)

- **New test suite**: Production viewport tests that run against a deployed OE3 instance.
- **JWT cookie injection**: Generates a valid superadmin JWT via `docker exec` on the backend container and sets it as a Playwright cookie — authenticates without going through the MFA flow.
- **Desktop tests (1280×800)**: App loads without console errors, study list renders with data (73 studies), study detail page with sortable series table + statistics card.
- **Mobile tests (375×812 — iPhone X)**: No horizontal scroll, table in scrollable container, touch target analysis (< 44px detection), navigation works.
- **DOM structure analysis**: Landmarks (main, nav, header), headings hierarchy, ARIA compliance, images without alt, inputs without labels.
- **Screenshots**: Full-page screenshots saved for each viewport (desktop-01-03, mobile-01-04).

### Files Changed

```
Modified:
  README.md
  docs/fork-changelog.md
  src/app/layout/AppLayout.tsx
  src/app/layout/UserBadge.tsx
  src/features/studies/pages/StudyDetailPage.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/lib/correlation.ts

Added:
  e2e/prod/playwright.prod.config.ts
  e2e/prod/prod-viewport.spec.ts
  src/app/providers/AuthGate.tsx
```

---

## Upstream Sync

To merge upstream changes into this fork:

```bash
git remote add upstream https://github.com/rhavekost/orthanc-explorer-3.git
git fetch upstream
git merge upstream/main
# Resolve conflicts in modified files (StudyListPage, StudyDetailPage, i18n, etc.)
git push origin main
```
