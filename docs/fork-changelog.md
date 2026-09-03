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

## Upstream Sync

To merge upstream changes into this fork:

```bash
git remote add upstream https://github.com/rhavekost/orthanc-explorer-3.git
git fetch upstream
git merge upstream/main
# Resolve conflicts in modified files (StudyListPage, StudyDetailPage, i18n, etc.)
git push origin main
```
