# Fork Changelog

Changes in this fork (`emanuel901z-hue/orthanc-explorer-3-usable`) vs upstream (`rhavekost/orthanc-explorer-3`).

---

## v2.1.0 — UX/Accessibility/i18n Optimization Sprint (2026-09-06)

### Critical: Accessibility (A11y)

- **H1 page titles added** to `StudyDetailPage`, `SeriesDetailPage`, `ActivityPage` — these pages previously had no `<h1>` heading, breaking screen-reader navigation. Each page now has an `sr-only` H1 (visible title remains the breadcrumb/summary badges).
- **`aria-label` added** to ActivityPage search input (was missing — screen readers could not identify the search field).
- **`aria-label` added** to ActivityPage clear-search button (was a bare icon button with no accessible name).
- **Mobile checkbox `aria-label`** on StudyListPage changed from hardcoded `"Select row"` to i18n key `studyList.selectRow` (9 locales).

### High: i18n — keyboard shortcut selector refactor

- **`/` keyboard shortcut selector** in `use-keyboard-shortcuts.ts` replaced from locale-specific placeholder matching (`input[placeholder*="Search"], input[placeholder*="Such"], input[placeholder*="Поиск"]` — only 6/9 languages) to an **i18n-agnostic `data-shortcut="search"` attribute**. The `/` shortcut now works in all 9 supported languages without maintaining a selector list.
- `data-shortcut="search"` attribute added to search inputs on StudyListPage, ActivityPage, AuditLogsPage.

### High: i18n — hardcoded English strings eliminated

- **StudyDetailPage**: 6 hardcoded English strings replaced with i18n keys:
  - `"Study not found"` → `t('studies.notFound')`
  - `"Back to Studies"` → `t('studies.backToList')`
  - `"This will permanently delete..."` delete confirmation → `t('study.deleteConfirmPrefix')` + `t('study.deleteConfirmSuffix', { series, instances })`
  - `"Patient"` CardTitle → `t('study.patient')`
  - `"{{count}} series downloaded"` toast → `t('study.bulkDownloadSuccess')`
  - `"Bulk download failed."` toast → `t('study.bulkDownloadFailed')`
- **WorklistsPage**: hardcoded `"Upload"` (mobile span) → `t('worklists.upload')`.
- **11 new i18n keys** added to all 9 locales (en/es/fr/de/ja/zh/ru/tr/ar): `studies.notFound`, `studies.backToList`, `study.patient`, `study.deleteConfirmPrefix`, `study.deleteConfirmSuffix`, `study.bulkDownloadSuccess`, `study.bulkDownloadFailed`, `study.apiView`, `activity.title`, `studyList.selectRow`, `activity.clearSearch`. All locales now at 799 keys (was 788).

### Medium: Touch target sizes (WCAG 2.5.5)

- **ModalitiesTab** echo/edit/delete icon buttons: `h-7 w-7` (28px) → `h-9 w-9` (36px) with icon size `h-4 w-4`.
- **WorklistsPage** delete button (desktop table): `h-7 w-7` (28px) → `h-9 w-9` (36px) + `aria-label` added.
- **WorklistsPage** delete button (mobile card): `h-8 w-8` (32px) → `h-10 w-10` (40px) + `aria-label` added.
- **ActivityPage** clear-search button: `h-7 w-7` (28px) → `h-9 w-9` (36px) + `aria-label` added.
- **AppLayout** keyboard help button: `h-8 w-8` (32px) → `h-9 w-9` (36px).

### Medium: Embedded theming compliance

- **WorklistsPage** warning card: hardcoded `border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400` replaced with theming-system CSS variables: `border-warning/30 bg-warning/5 text-warning` (uses `--warning` CSS var from `index.css`, respects white-labeling).

### Tests added

- `StudyDetailPage.test.tsx`: H1 accessibility test (verifies sr-only H1 with patient name).
- `use-keyboard-shortcuts.test.tsx` (new, 4 tests): `/` focuses `[data-shortcut="search"]` input, does not focus when already in input, `?` opens help, ctrl/cmd suppression.
- E2E `prod-viewport.spec.ts`: A11y regression block (H1 presence, data-shortcut + aria-label on search, icon-only button aria-labels, img alt text) + touch target size block (mobile 375x812, icon-only buttons >= 36px).

### Files Changed

```
Modified:
  docs/fork-changelog.md
  e2e/prod/prod-viewport.spec.ts
  src/app/layout/AppLayout.tsx
  src/features/activity/pages/ActivityPage.tsx
  src/features/audit/pages/AuditLogsPage.tsx
  src/features/series/pages/SeriesDetailPage.tsx
  src/features/settings/components/ModalitiesTab.tsx
  src/features/studies/pages/StudyDetailPage.test.tsx
  src/features/studies/pages/StudyDetailPage.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/features/worklists/pages/WorklistsPage.tsx
  src/i18n/locales/{ar,de,en,es,fr,ja,ru,tr,zh}.json
  src/shared/hooks/use-keyboard-shortcuts.ts

Added:
  src/shared/hooks/use-keyboard-shortcuts.test.tsx
```

---

## v2.0.0 — Bugfix Sprint: RBAC, Audit, PHI, Type Safety (2026-09-06)

### Critical: Feature-flag RBAC security fix

- **`features.ts` resolver ignored legacy `enableX` config.js keys** — `config.prod.js` sets `enableDelete: false`, `enableModify: false`, `enableAnonymize: false`, `enableSendTo: false`, but the resolver looked up `features['delete']` (not `features['enableDelete']`), so all dangerous write actions stayed **enabled in production** despite the disable flag. Fix: `FEATURE_ALIASES` map (`enableDelete`→`delete`, `enableSendTo`→`send`, `enableModalityConfig`→`modalityManagement`, etc.). + 4 regression tests.

### High: Audit trail — BEFORE+AFTER events for all 17 write actions

- All 17 write actions (`deleteStudy`, `deleteSeries`, `deleteInstance`, `modifyStudy/Series/Instance`, `anonymizeStudy/Series/Instance`, `sendStudy/Series/Instance`, `mergeStudy`, `uploadInstances`, `saveModality`, `deleteModality`, `saveDicomWebServer`, `deleteDicomWebServer`, `addLabel`, `removeLabel`) now emit a `started` audit event BEFORE the API call, followed by `success`/`failure` after. Previously only a single AFTER event was emitted — a crash between API call and callback left no audit trail.

### High: PHI leak fix in upload audit

- `uploadInstancesAction` used `file.name` as audit `resourceId` — DICOM filenames can carry patient names/MRN/DOB. Fix: non-PHI `batchId` for the `started` event, Orthanc-assigned UUID (`result.ID`) for the `success` event.

### High: Smart search 4-digit date parser

- `smart-search.ts` 4-digit date token parser read `"2908"` as `dd=2, mm=9` (single digits) instead of `dd=29, mm=08`. Fix: `tokenDigits.slice(0,2)` / `slice(2,4)`. + 24 regression tests in new `smart-search.test.ts`.

### High: Audit system gaps

- `AuditEvent` type extended with `detail?: Record<string, unknown>` (for merge/modify metadata, server-side only — never client-logged).
- `auditClient.emit()` now logs `destinationId` (was silently dropped by logger allowlist).
- `outcome` union extended with `'started'`.
- `logger.ts` ALLOWLIST extended with `destinationId`.
- `deleteDicomWebServer`/`saveDicomWebServer` `resourceType` normalized from `'dicomweb-server'` (not in union) to `'dicomWebServer'`.

### Medium: Logic bugs

- `AuditLogsPage.tsx`: search filter used `e.user` (non-existent property) instead of `e.actor` — user search never matched.
- `RemoteSourcesPage.tsx`: modality selector accessed `lastEchoStatus`/`lastEcho` not in the inline type — Wifi icon always showed offline.
- `orthanc-study-repository.ts`: `result.map(mapOrthancInstance)` passed Array `index` as `rawTags` argument (silent logic bug). Fix: arrow wrapper.
- `saveDicomWebServer.ts`: Basic auth header `btoa(user + ':')` missing password (RFC 7617 violation). Fix: `btoa(user + ':' + (clientSecret ?? ''))`.

### Low: Transport/Correlation

- `client.ts`: raw `TypeError` from `fetch` network failures now wrapped into PHI-safe `OrthancError(0, correlationId, 'Network error...')`.
- `correlation.ts`: `Math.random` fallback branch documented as unreachable (getRandomValues available in all contexts).

### Type safety — 18 tsc errors fixed

- `deleteStudyAction`, `modifyStudyAction`, `anonymizeStudyAction` signatures simplified from `(study: Study)` to `(studyId: string)` — eliminates caller-side `as any` casts.
- Test stubs: `OrthancStudy` mocks updated with `IsStable`/`Labels`/`LastUpdate`, `ChangesResponse.First`, `OrthancStats.TotalDiskSizeMB/TotalUncompressedSize`, `JobState` cast.
- `StudyListPage` `getResizeOffset()` (v7 API) removed for `@tanstack/react-table` v8.21.
- `CornerstoneViewport` `WADORSMetaData` cast for `@cornerstonejs/core` v4.22.

### Test suite

- **213 tests** (was 189, 1 failing) → **218 tests**, all passing.
- `tsc --noEmit -p tsconfig.app.json`: **0 errors** (was 18).
- New: `smart-search.test.ts` (24 tests), `use-keyboard-shortcuts.test.tsx` (4 tests), `correlation.test.ts` (getRandomValues branch), `features.test.tsx` (enableX aliases), `deleteStudy/anonymizeStudy/modifyStudy.test.ts` (started+success audit).

### Files Changed

```
Modified (47 files):
  src/actions/*.ts (17 action files — BEFORE+AFTER audit + signatures)
  src/actions/*.test.ts (test updates for new signatures + audit events)
  src/config/features.ts (+ FEATURE_ALIASES)
  src/config/features.test.tsx (+ enableX alias tests)
  src/lib/audit.ts (+ detail field, destinationId logging)
  src/lib/logger.ts (+ destinationId allowlist)
  src/lib/client.ts (network error wrapping)
  src/lib/correlation.ts (Math.random comment)
  src/lib/correlation.test.ts (getRandomValues branch tests)
  src/lib/smart-search.ts (4-digit parser fix)
  src/features/audit/pages/AuditLogsPage.tsx (user→actor)
  src/features/servers/pages/RemoteSourcesPage.tsx (lastEcho type)
  src/features/studies/pages/StudyDetailPage.tsx (deleteMutation signature)
  src/features/studies/pages/StudyListPage.tsx (deleteStudyAction signature)
  src/features/studies/components/ModifyStudyDialog.tsx (modifyStudyAction signature)
  src/features/tasks/hooks/use-anonymize-job.ts (anonymizeStudyAction signature)
  src/shared/api/orthanc-study-repository.ts (mapOrthancInstance wrapper)
  src/features/settings/components/ModalitiesTab.test.tsx (i18n mock fix)
  src/features/activity/hooks/useChanges.test.tsx (First field)
  src/features/settings/hooks/use-system-info.test.tsx (OrthancStats)
  src/features/tasks/hooks/use-anonymize-job.test.ts (JobState cast)
  src/features/viewer/components/CornerstoneViewport.tsx (WADORSMetaData cast)
  src/features/studies/pages/StudyListPage.tsx (getResizeOffset removal)
  e2e/prod/prod-viewport.spec.ts (RBAC + smart-search E2E)
  src/i18n/locales/*.json (9 locales, +9 keys each)

Added:
  src/lib/smart-search.test.ts (24 tests)
  src/shared/hooks/use-keyboard-shortcuts.test.tsx (4 tests)
```

---

## v1.9.0 — About Dialog i18n + Umlaut Description Fix (2026-09-05)

### Bug fix: Umlaut normalization description

- **Incorrect "Müller=Muehler"** in all 9 locale files (`search.hintText`, `search.helpName`) — the actual code normalizes `ü` → `ue` (correct German transcription), not `ü` → `ueh`. Fixed to "Müller=Mueller" in all locales.
- README.md umlaut description expanded to show all 4 rules: `ü`→`ue`, `ä`→`ae`, `ö`→`oe`, `ß`→`ss`.

### About dialog — fully translated (all 9 locales)

- Added `about` namespace with `description`, `systemInfo`, `appVersion`, `orthancVersion`, `orthancApi`, `dicomAet`, `databaseVersion`, `plugins`, `pluginsLoaded`, `storage`, `storageStats`, `platform`, `forkFeatures`, and `features.*` keys.
- AboutDialog now uses `useTranslation()` for all labels and descriptions.
- Version bumped from `1.3.0` → `1.8.0`.
- Added new fork feature badges: Mobile card views, Keyboard shortcuts, Worklists, Audit logs.
- System info labels (App Version, Orthanc Version, etc.) now localized.

### README.md updates

- Smart Multi-Token Search description now lists all 4 umlaut rules and both example formats.
- Added Keyboard Shortcuts, Mobile Card Views, and Mobile Sidebar Navigation to fork enhancements table.
- Key capabilities list updated with keyboard shortcuts and mobile responsive entries.

### Files Changed

```
Modified:
  README.md
  docs/fork-changelog.md
  src/app/layout/AboutDialog.tsx
  src/i18n/locales/ar.json
  src/i18n/locales/de.json
  src/i18n/locales/en.json
  src/i18n/locales/es.json
  src/i18n/locales/fr.json
  src/i18n/locales/ja.json
  src/i18n/locales/ru.json
  src/i18n/locales/tr.json
  src/i18n/locales/zh.json

Added:
  scripts/add-about-i18n.py
```

---

## v1.8.0 — Keyboard Shortcuts Expansion + i18n (2026-09-05)

### New keyboard shortcuts

| Key | Action | Scope |
|-----|--------|-------|
| `G → L` | Go to Audit Logs | Global |
| `G → W` | Go to Worklists | Global |
| `E` | Export data (CSV/JSON) | Activity, Audit Logs |
| `R` | Refresh data | Any view with refresh button |
| `N` | New / Add | Settings (add modality/server), Worklists (upload) |
| `T` | Toggle filters | Studies |
| `C` | Toggle columns | Studies |
| `Esc` | Close dialog / dropdown / blur | Global (enhanced) |

### Enhanced existing shortcuts

- **Escape** now also closes Radix dialog overlays and the studies column-config dropdown (via `data-col-config-open` attribute)
- **`/` focus search** now matches placeholders in all 9 languages (German "Suche", Russian "Поиск", Chinese "搜索", Japanese "検索", etc.)

### i18n — Shortcuts dialog translated (all 9 locales)

- Added `shortcuts` namespace with `nav.*`, `actions.*`, `general.*`, `categories.*`, `dialogTitle`, `dialogHint` keys
- `KeyboardShortcutsDialog` now uses `useTranslation()` for all labels
- `AppLayout` tooltip for keyboard button now translated
- Shortcut descriptions in the help dialog are now fully localized

### Files Changed

```
Modified:
  src/app/layout/AppLayout.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/shared/components/KeyboardShortcutsDialog.tsx
  src/shared/hooks/use-keyboard-shortcuts.ts
  src/i18n/locales/ar.json
  src/i18n/locales/de.json
  src/i18n/locales/en.json
  src/i18n/locales/es.json
  src/i18n/locales/fr.json
  src/i18n/locales/ja.json
  src/i18n/locales/ru.json
  src/i18n/locales/tr.json
  src/i18n/locales/zh.json
  docs/fork-changelog.md

Added:
  scripts/add-shortcuts-i18n.py
```

---

## v1.7.0 — Comprehensive Mobile + i18n Audit (2026-09-05)

### Mobile Card Views (all tables)

- **ActivityPage**: Desktop table hidden on mobile (`hidden md:block`); mobile cards show severity icon, category badge, title, description, timestamp, duration, actor. Export CSV button label shortened to "CSV" on mobile. Subtitle hidden on mobile to save space.
- **AuditLogsPage**: Desktop table hidden on mobile; mobile cards show action badge, severity badge, title, timestamp. Filter Select full-width on mobile.
- **WorklistsPage**: Desktop table hidden on mobile (`hidden sm:table`); mobile cards show worklist badge + full ID + delete button. Header switches to column layout on mobile. Upload button label shortened on mobile.
- **ModalitiesTab**: Desktop table hidden on mobile; mobile cards show health indicator, name, action buttons (echo/edit/delete), AET/host/port/manufacturer grid, last echo time. Echo All / Add Modality buttons show icon-only on mobile. Summary bar wraps vertically on mobile.
- **DicomWebTab**: Desktop table hidden on mobile; mobile cards show status, name, action buttons, URL (break-all), auth type, capability badges. Add Server button icon-only on mobile. Summary bar wraps vertically on mobile.
- **ViewerTab**: Grid changed from `md:grid-cols-2` to single column always (cards are too wide for 2-col on mobile). Test All button icon-only on mobile. Per-card buttons (Test/Edit/Set Default) show icon-only on mobile. Status badge `shrink-0` to prevent overflow.

### i18n — Missing translations added (all 9 locales)

- **auditLogs namespace**: Added `title`, `subtitle`, `export`, `clear`, `search`, `allActions`, `events`, `timestamp`, `action`, `event`, `severity`, `empty` to all 9 locales (ar, de, en, es, fr, ja, ru, tr, zh). Removed all `defaultValue` fallbacks from AuditLogsPage.
- **worklists namespace**: Added `title`, `subtitle`, `upload`, `deleted`, `deleteFailed`, `uploaded`, `uploadFailed`, `pluginNotInstalled`, `count`, `empty`, `actions`, `type`, `worklist` to all 9 locales. Removed all `defaultValue` fallbacks and hardcoded "ID"/"Type"/"Worklist" strings from WorklistsPage.
- **studyList.columns**: Added `config` ("Columns"/"Spalten"/...), `toggle`, `view` to all 9 locales. Removed `defaultValue` fallbacks from StudyListPage.
- **studyList top-level**: Added `labels`, `labelModeAny`, `labelModeAll`, `withoutLabels` to all 9 locales. Removed `defaultValue` fallbacks.
- **modality namespace**: Added `health`, `name`, `aet`, `host`, `port`, `manufacturer`, `lastEcho`, `actions`, `echoAll`, `addModality`, `online`, `offline`, `notEchoed`, `echoSuccess`, `echoFailed`, `deleted`, `deleteFailed`, `deleteTitle`, `deleteDescription`, `noModalities`, `summary` to all 9 locales. Replaced all hardcoded English strings in ModalitiesTab (tooltips, toast messages, table headers, dialog text, summary bar).
- **dicomweb namespace**: Added `status`, `url`, `auth`, `capabilities`, `addServer`, `connected`, `serverCount`, `noServers`, `summary`, `extTitle`, `extDesc`, `query`, `retrieve`, `notConfigured`, `apiKey`, `noApiKey`, `extNotAvailable`, `extFooter`, `testConnection` to all 9 locales. Replaced all hardcoded English strings in DicomWebTab.

### Shared component fixes

- **Switch component**: Fixed thumb positioning — `translate-x-5` → `translate-x-[22px]` and added `translate-x-0.5` for unchecked state. `shadow-lg` → `shadow-md`. Ensures the toggle knob is properly positioned within the track on all viewports.
- **Select component**: Added `w-[var(--radix-select-trigger-width)]` to SelectContent so dropdown matches trigger width on mobile (prevents oversized dropdowns when trigger is `w-full` in a grid).
- **SettingsPage tabs**: Tab labels hidden on mobile (`hidden sm:inline`), showing only icons. Prevents tab overflow on narrow screens.
- **SettingsPage appearance grid**: Reduced gap on mobile (`gap-2` vs `sm:gap-3`).
- **StudyListPage buttons**: Filters and Columns buttons show icon-only on mobile, full label on desktop. Added `shrink-0` to prevent button compression.

### Files Changed

```
Modified:
  src/components/ui/select.tsx
  src/components/ui/switch.tsx
  src/features/activity/pages/ActivityPage.tsx
  src/features/audit/pages/AuditLogsPage.tsx
  src/features/settings/components/DicomWebTab.tsx
  src/features/settings/components/ModalitiesTab.tsx
  src/features/settings/components/ViewerTab.tsx
  src/features/settings/pages/SettingsPage.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/features/worklists/pages/WorklistsPage.tsx
  src/i18n/locales/ar.json
  src/i18n/locales/de.json
  src/i18n/locales/en.json
  src/i18n/locales/es.json
  src/i18n/locales/fr.json
  src/i18n/locales/ja.json
  src/i18n/locales/ru.json
  src/i18n/locales/tr.json
  src/i18n/locales/zh.json
  docs/fork-changelog.md

Added:
  scripts/add-missing-i18n.py
```

---

## v1.6.0 — Mobile Responsive Card Views + Runtime Config Fix (2026-09-04)

### Mobile Card Views (no more horizontal scroll)

- **`useMediaQuery` hook** (`src/shared/hooks/use-media-query.ts`): Reactive CSS media query hook with `addEventListener` for real-time breakpoint switching. Used by StudyListPage and StudyDetailPage to switch between table (desktop) and card (mobile) layouts at the `md` breakpoint (768px).
- **StudyListPage mobile cards**: On screens < 768px, studies render as vertical cards instead of a 1200px-wide scrollable table. Each card shows patient name + ID, status dot, study date, modality badges, accession number, image/series count, and description. Quick-viewer and quick-report buttons are inline. Checkbox for bulk selection is preserved.
- **StudyDetailPage series cards**: On mobile, the series table (700px minWidth) switches to compact cards showing series number, modality badge, image count, description, and truncated SeriesInstanceUID. Checkbox for bulk selection preserved.
- **Mobile hamburger menu**: Added `SidebarTrigger` (Menu icon) to the header, visible only on mobile (`md:hidden`). Without this, the sidebar drawer (Settings, Activity, Jobs, Upload, Servers) was inaccessible on mobile — only studies were reachable via the tab bar. The `SidebarTrigger` component was enhanced to accept custom children (icon override) instead of always rendering the default `PanelLeft` icon.

### Runtime Config Fix (GAP-Test)

- **3 files fixed**: `AddSeriesDialog.tsx`, `StudyDetailPage.tsx`, `SystemInfoTab.tsx` — replaced hardcoded `(window as any).__OE3_CONFIG__?.orthancUrl || '/orthanc-proxy'` with `getConfig().orthancUrl` from `@/config/runtime`. Consistent with `upload-store.ts` and `cornerstoneImageIds.ts` patterns.

### Files Changed

```
Added:
  src/shared/hooks/use-media-query.ts

Modified:
  src/app/layout/AppLayout.tsx
  src/components/ui/sidebar.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/features/studies/pages/StudyDetailPage.tsx
  src/features/studies/components/AddSeriesDialog.tsx
  src/features/settings/components/SystemInfoTab.tsx
```

---

## v1.5.0 — Sprint 2: External Viewers, Remote Q/R, Sharing, Worklists, Custom Buttons, Add-Series (2026-09-04)

### Sprint 2A: External Viewers

- **VolView, MedDream, Weasis integration**: Open-in-viewer buttons for three additional external viewers. Viewer list configurable in Settings (ViewerTab), persisted to `localStorage`. MedDream added to the viewer type list.
- **ViewerTab enhancements**: Add/edit/remove viewer configs with type selection (OHIF, Stone, VolView, MedDream, Weasis), URL, default viewer, enable/disable toggle.

### Sprint 2B: Modification Modes

- **Modify in-place vs Create duplicate**: Mode selector in `ModifyStudyDialog` — `KeepSource: false` (modify in-place) vs `KeepSource: true` (create duplicate). Orthanc `/studies/:id/modify` called with the selected mode.

### Sprint 2C: Remote Query/Retrieve

- **C-FIND query UI**: `POST /modalities/:name/query` — query remote modalities for studies by patient name, ID, accession, date range, modality.
- **C-MOVE retrieve**: Retrieve query answers from remote modalities. Results table with per-answer retrieve buttons.
- **Functional Echo button**: C-ECHO (`POST /modalities/:name/echo`) to test modality connectivity.
- **RemoteSourcesPage**: Enhanced remote sources page with query/retrieve workflow.

### Sprint 2D: Study Sharing

- **ShareStudyDialog**: Share a study via Orthanc Shares plugin (`POST /shares`) if installed, with instant viewer link fallback (no plugin required).
- **Share by email**: `mailto:` link with pre-filled subject and body.
- **Share link copy to clipboard**: One-click copy button.
- **Expiration date and description**: Optional fields for shared links.
- **shares API**: `src/api/shares.ts` — create, list, get, delete shares.

### Sprint 2E: Worklists

- **WorklistsPage**: List, upload, delete DICOM worklists (`/worklists`).
- **Worklists API**: `src/api/worklists.ts` — list, get, query, delete, upload worklists.
- **Sidebar entry + route**: Worklists page registered in App sidebar and router.

### Sprint 2F: Custom Buttons + Add Series

- **Custom HTTP buttons**: Configurable buttons that open arbitrary URLs with template tokens (`{studyId}`, `{patientId}`, `{accession}`, `{studyDate}`, etc.). Config persisted to `localStorage` via `src/lib/custom-buttons.ts`.
- **AddSeriesDialog**: Upload PDF/JPEG/PNG/STL files as a new DICOM series within an existing study. Uses Orthanc `/tools/create-dicom` for encapsulation.

### Files Changed

```
Added:
  oe3/src/api/shares.ts
  oe3/src/api/worklists.ts
  oe3/src/features/studies/components/AddSeriesDialog.tsx
  oe3/src/features/studies/components/ShareStudyDialog.tsx
  oe3/src/features/worklists/pages/WorklistsPage.tsx
  oe3/src/lib/custom-buttons.ts

Modified:
  oe3/src/App.tsx
  oe3/src/api/modalities.ts
  oe3/src/app/layout/AppSidebar.tsx
  oe3/src/features/servers/pages/RemoteSourcesPage.tsx
  oe3/src/features/settings/components/ViewerTab.tsx
  oe3/src/features/studies/components/ModifyStudyDialog.tsx
  oe3/src/features/studies/pages/StudyDetailPage.tsx
```

---

## v1.4.0 — Sprint 1: 18 Features from OE2/OE3 Audit (2026-09-04)

### Batch A: Download Enhancements

- **Custom filename templates**: Download studies/series/instances with templated filenames (`{patientName}_{studyDate}_{accession}`). Template engine in `src/lib/filename-template.ts`.
- **DICOM-DIR download**: ZIP with DICOMDIR index via Orthanc `/studies/:id/media` endpoint.
- **NIfTI export**: Download instances as NIfTI via `/instances/:id/nifti`.
- **"Without labels" filter**: `LabelsConstraint: None` — exclude studies with specific labels.

### Batch B: Study List UX

- **Quick-Report button**: Printable study summary dialog (`QuickReportDialog`) → browser print/PDF export.
- **Default ordering via URL param**: `order-by=field:desc` query parameter for deep-linkable sort state.
- **Column show/hide configuration**: Dropdown to toggle column visibility in the study list.
- **Multi-Label AND/OR search toggle**: Switch between `LabelsConstraint: 'All'` (AND) and `LabelsConstraint: 'Any'` (OR) for label filtering.

### Batch C: Bulk Operations + Activity

- **Bulk series send**: C-STORE multiple series to a modality in one action.
- **Bulk series delete**: Delete multiple series with confirmation dialog.
- **Job resource display**: Parsed `Content.Resources` from Orthanc jobs shown in activity detail.
- **"My Jobs" filter**: Filter activity page to show only client-side jobs (not server-side Orthanc jobs).

### Batch D: Settings + Audit

- **Global Audit Logs page** (`/audit-logs`): Searchable, filterable audit log viewer with JSON export.
- **31 modality filter options**: Expanded from 7 to 31 modality type filters in the study list.
- **Date format config**: User-configurable date format in UI store (`ui-store.ts`).
- **Plugin status badges**: Active/Loaded status indicators in `SystemInfoTab`.

### Batch E: Developer + Mobile

- **ApiView button**: Opens the Orthanc REST URL for a resource in a new tab — useful for debugging.
- **Log level control**: Functional `PUT /tools/log-level` — change Orthanc log level from the UI.
- **Touch-optimized controls**: 44px minimum touch target size on `pointer:coarse` devices (CSS in `index.css`).

### Files Changed

```
Added:
  oe3/src/actions/deleteSeries.ts
  oe3/src/features/audit/pages/AuditLogsPage.tsx
  oe3/src/features/studies/components/QuickReportDialog.tsx
  oe3/src/lib/filename-template.ts

Modified:
  oe3/src/App.tsx
  oe3/src/actions/downloadInstance.ts
  oe3/src/actions/downloadSeries.ts
  oe3/src/actions/downloadStudy.ts
  oe3/src/api/instances.ts
  oe3/src/api/series.ts
  oe3/src/api/studies.ts
  oe3/src/api/tools.ts
  oe3/src/app/layout/AppSidebar.tsx
  oe3/src/features/activity/components/ActivityDetailPanel.tsx
  oe3/src/features/activity/pages/ActivityPage.tsx
  oe3/src/features/instances/pages/InstanceDetailPage.tsx
  oe3/src/features/settings/components/SystemInfoTab.tsx
  oe3/src/features/studies/pages/StudyDetailPage.tsx
  oe3/src/features/studies/pages/StudyListPage.tsx
  oe3/src/index.css
  oe3/src/shared/api/orthanc-study-repository.ts
  oe3/src/shared/types/dicom.ts
  oe3/src/store/ui-store.ts
```

---

## v1.3.0 — Custom Branding & Logo Integration (2026-09-04)

### Branding/Logo

- **Configurable logo via `branding.logoUrl`**: Runtime config now supports an optional `logoUrl` field in the `branding` object. When set, the logo image is displayed in the header, sidebar header, and About dialog. Falls back to a bundled default logo (`public/logo/oe3-logo-128.png`) when omitted.
- **Bundled logo assets**: Optimized PNG assets in `public/logo/` (32px, 64px, 128px, 256px, favicon). Source logo in `Logo/` directory.
- **`ui-store.ts`**: New `logoUrl` field with `setLogoUrl()` action. Excluded from `localStorage` persistence (always sourced from runtime config at boot).
- **`main.tsx`**: Synchronizes `branding.logoUrl` from `config.js` → ui-store on app boot.
- **`AppLayout.tsx`**: Header shows `<img>` logo instead of the "O3" text placeholder. `onError` fallback hides the image if it fails to load.
- **`AppSidebar.tsx`**: Sidebar header shows logo + app name (replaces the previous text-only footer copyright).
- **`AboutDialog.tsx`**: Logo displayed next to the dialog title.
- **`index.html`**: Favicon, apple-touch-icon, and Open Graph/Twitter image tags point to bundled logo assets. Vite rewrites `/logo/` paths to `/oe3/logo/` in production builds.
- **`config.js` / `config.prod.js`**: Updated with `branding.logoUrl` examples.

### Test Fixes

- **`studies.test.ts`**: Updated `get()` test to expect `requestedTags` query parameter (added in v1.1.0).
- **`StudyDetailPage.test.tsx`**: Added mock for `MigrateStudyDialog` (added in v1.1.0) to prevent `useStudies` mock error.
- **`orthanc-study-repository.test.ts`**: Updated `findAll` test to expect the full `RequestedTags` array (4 tags, not 2).

### Files Changed

```
Modified:
  index.html
  public/config.js
  public/config.prod.js
  src/api/studies.test.ts
  src/app/layout/AboutDialog.tsx
  src/app/layout/AppLayout.tsx
  src/app/layout/AppSidebar.tsx
  src/features/studies/pages/StudyDetailPage.test.tsx
  src/main.tsx
  src/shared/api/orthanc-study-repository.test.ts
  src/store/ui-store.ts
  README.md
  docs/fork-changelog.md

Added:
  Logo/OE_3_LOGO.png              # Source logo (2016×2086, 4.7MB)
  public/logo/oe3-logo-128.png    # Header/sidebar (33KB)
  public/logo/oe3-logo-256.png    # About dialog/apple-touch (115KB)
  public/logo/oe3-logo-64.png     # Small variant (9.4KB)
  public/logo/oe3-logo-32.png     # Tiny variant (2.9KB)
  public/logo/oe3-favicon.png     # Browser favicon (115KB)

Removed:
  public/logo.png                 # Unused duplicate from earlier iteration
```

---

## v1.2.1 — Study/Series Merge, Smart Search, Activity & Settings Enhancements (2026-09-04)

### Study/Series Merge (Migrate)

- **MigrateStudyDialog** (`src/features/studies/components/MigrateStudyDialog.tsx`): Merge one or more source studies into a target study via Orthanc `POST /studies/:id/merge`. Searchable source list with patient name, ID, description, accession, SIUID, and modality filtering. Highlights studies with the same StudyInstanceUID (likely merge candidates). Optional `KeepSource` checkbox — when unchecked, source studies are deleted after merge.
- **MigrateSeriesDialog** (`src/features/series/components/MigrateSeriesDialog.tsx`): Move a single series from its current study into a target study. Same merge endpoint with series ID as resource. Searchable target study list.
- **mergeStudyAction** (`src/actions/mergeStudy.ts`): Audit-seam wrapper for merge operations. Emits `study.merge` audit event with source IDs, keepSource flag, and merged count.
- **studiesApi.merge()**: New API method — `POST /studies/:id/merge` with `{ Resources, KeepSource }` body.
- **StudyDetailPage**: "Migrate" button (GitMerge icon) opens MigrateStudyDialog.
- **SeriesDetailPage**: "Migrate" button opens MigrateSeriesDialog.

### Smart Multi-Token Search

- **smartSearch** (`src/lib/smart-search.ts`): Client-side multi-token search with umlaut tolerance and date pattern matching. Splits query by comma/whitespace, requires every token to match at least one field (AND across tokens, OR across fields). Enables combined searches like "Müller, CT, 29.08" or "Muell ct 2908".
- **Umlaut normalization**: "ü" matches "ue", "ä" matches "ae", "ö" matches "oe", "ß" matches "ss" (and vice versa).
- **Date patterns**: "2908", "290826", "29.08.2026", "29082026" all match "2026-08-29". Supports ISO and locale (DD.MM.YYYY) formats.
- **StudyListPage**: Smart search runs client-side on top of Orthanc results — fetches all studies, then filters with `smartSearch()` across patient name, ID, accession, description, modality, SIUID, and study date.

### Activity Page Enhancements

- **useOrthancJobs** (`src/features/activity/hooks/useOrthancJobs.ts`): Live polling of Orthanc jobs (expanded) every 3 seconds. Sorted by CreationTime descending.
- **ActivityDetailPanel** (`src/features/activity/components/ActivityDetailPanel.tsx`): Detail panel for activity events with action icons, severity indicators, navigation to related resources, and metadata display.
- **ActivityPage**: Merges live audit events, Orthanc jobs, client-side jobs, and change events into a unified timeline. Deduplicates by event ID. Job type icons for merge, transcode, split, archive, move, and standard operations.

### Settings: Viewer Configuration

- **ViewerTab** (`src/features/settings/components/ViewerTab.tsx`): Manage external viewer integrations (OHIF, Stone Web Viewer, VolView, etc.). Add/edit/remove viewer configs with URL, type (web/desktop), default viewer selection, and enable/disable toggle. Status indicators (connected/configured/not configured).

### Settings: DICOMweb Server Management

- **DicomWebTab** (`src/features/settings/components/DicomWebTab.tsx`): Enhanced DICOMweb server management with auth type indicators (bearer/basic/oauth2/none). Fetches and displays external PACS QIDO/WADO configuration from the backend proxy. Add/edit/remove servers with URL, auth type, and API key management.

### Settings: Embedded Theming

- **EmbeddedThemingCard** (`src/features/settings/components/EmbeddedThemingCard.tsx`): White-labeling card for embedded deployments. Configure app name, primary/accent colors, font presets, border radius, compact mode, and sidebar/header visibility. Settings persist to `localStorage` and apply via CSS custom properties.

### Files Changed

```
Added:
  src/actions/mergeStudy.ts
  src/features/activity/hooks/useOrthancJobs.ts
  src/features/activity/components/ActivityDetailPanel.tsx
  src/features/series/components/MigrateSeriesDialog.tsx
  src/features/studies/components/MigrateStudyDialog.tsx
  src/features/settings/components/ViewerTab.tsx
  src/lib/smart-search.ts

Modified:
  src/api/jobs.ts
  src/api/studies.ts
  src/features/activity/pages/ActivityPage.tsx
  src/features/instances/pages/InstanceDetailPage.tsx
  src/features/series/pages/SeriesDetailPage.tsx
  src/features/settings/components/DicomWebTab.tsx
  src/features/settings/components/EmbeddedThemingCard.tsx
  src/features/settings/pages/SettingsPage.tsx
  src/features/studies/pages/StudyDetailPage.tsx
  src/features/studies/pages/StudyListPage.tsx
  src/i18n/locales/*.json (9 languages — merge/migrate/smart-search keys)
```

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
  1. Catch-all `/orthanc` proxy exists with appropriate RBAC roles + correct pathRewrite
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

- **Critical bug**: `crypto.randomUUID()` is only available in secure contexts (HTTPS or `localhost`). On internal HTTP deployments (e.g. `http://10.0.0.1:8080`), it is `undefined` and throws a `TypeError` — silently caught by `orthancFetch`'s catch block, causing **all API calls to fail**. OE3 showed "0 studies found" despite studies existing in Orthanc.
- **Fix**: Fallback chain — `crypto.randomUUID()` → `crypto.getRandomValues()` with manual UUIDv4 formatting → `Math.random()` as last resort.

### Accessibility

- **Duplicate H1 fix**: Changed `<h1>` to `<span>` in `AppLayout.tsx` header — was creating 2 H1 tags per page (header + page title). Now only one H1 per page for SEO/screen readers.
- **aria-label on search inputs**: Added `aria-label` to the patient search input in `StudyListPage.tsx` and the series filter input in `StudyDetailPage.tsx` — screen readers now announce the purpose of these inputs.

### Playwright E2E Tests (e2e/prod/)

- **New test suite**: Production viewport tests that run against a deployed OE3 instance.
- **JWT cookie injection**: Generates a valid JWT via `docker exec` on the backend container and sets it as a Playwright cookie — authenticates without going through the full auth flow.
- **Desktop tests (1280×800)**: App loads without console errors, study list renders with data, study detail page with sortable series table + statistics card.
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
