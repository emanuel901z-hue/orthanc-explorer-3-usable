---
status: in-progress
tags:
  - orthanc
  - react
  - typescript
  - ui
  - dicom
  - open-source
  - healthcare-it
  - lovable
date: 2026-02-06T00:00:00.000Z
last_updated: '2026-02-07T13:45:00-06:00'
---

# Orthanc Explorer 3 — Modern UI

## Vision

A ground-up modern frontend for Orthanc that treats the Orthanc REST API as a headless backend. **Orthanc is a great DICOM engine with a mediocre interface — separate the concerns.**

Standalone React/TypeScript SPA deployable as a Docker sidecar alongside Orthanc. No C++ compilation required. Any frontend developer can contribute.

---

## Why Build This

### Orthanc Explorer v1 (Legacy)

- Built-in to Orthanc core
- Bare HTML/jQuery — looks like a 2012 admin panel
- Still the default UI in most installations
- Functional but hostile to non-technical users

### Orthanc Explorer 2 (OE2) — Current State

- Built by the Orthanc Team (Alain Mazy / orthancteam)
- **Tech stack:** Vue.js + Bootstrap + Bootstrap Icons
- Improvement over v1 — study-level browsing, labels, Keycloak auth, share links, viewer integration
- **Limitations:**
  - Still feels like a developer tool, not a clinical or admin interface
  - Configuration-heavy: 300+ line JSON config file with 100+ `UiOptions` flags
  - Performance degrades with large databases and during DICOM ingestion
  - Architecture: Vue.js SPA compiled into C++ plugin — updating UI requires full plugin rebuild
  - Study-level only (no patient-level browsing)
  - No real-time updates (manual refresh required)
  - Limited batch operations
  - Modality/DICOMweb server management requires editing config files + restart

### Orthanc Tools JS (Third-Party)

- React + Bootstrap + Node.js frontend with authentication layer
- Adds batch processing, role management
- Still in beta, limited community adoption

### Community Demand

The Orthanc community has explicitly requested:

- Batch operations (anonymize, export, delete multiple studies)
- Better modality management (add/edit/test without config file editing)
- Drag-and-drop folder upload with recursive handling
- Custom metadata management
- Multi-level views (study + series on same page)
- Better search and filtering
- The Orthanc Team said: "It would be great if this could be maintained by the community for the community"

---

## Development Pipeline

### Phase 1: Requirements Generation (Claude)

- Audit OE2 feature set for complete parity checklist
- Document every Orthanc REST API endpoint the UI consumes
- Map every OE2 config option to a UI feature
- Define enhancement requirements (modern UX beyond OE2)
- Produce functional requirements with acceptance criteria

### Phase 2: UI Scaffolding (Lovable.dev)

- Generate all views and components from requirements
- Layout, navigation, responsive design, component library
- Dark/light theme, data tables, forms, modals
- Lovable outputs React + Tailwind — perfect for downstream work

### Phase 3: Logic & API Integration (VS Code + Claude Code)

- Port Lovable output into proper project structure
- Wire up Orthanc REST API calls with error handling
- DICOM tag parsing, date format handling, UID manipulation
- Auth flow (Basic auth, Keycloak/OIDC token support)
- DICOMweb integration (QIDO-RS, WADO-RS, STOW-RS)
- Azure OAuth token management (reuse Azure plugin pattern)
- State management, caching, optimistic updates
- Testing against real Orthanc instance

### Phase 4: Deployment (Azure + Docker)

- Containerize as Docker image
- Deploy as sidecar in Azure Container Apps alongside Orthanc
- Environment variable configuration
- Publish to GitHub Container Registry / Docker Hub
- Write deployment docs for Azure and generic Docker Compose

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18+ | Lovable outputs React, largest ecosystem, Claude Code excels at it |
| Language | TypeScript | Type safety critical for DICOM tag handling |
| Styling | Tailwind CSS | Lovable default, modern, responsive, utility-first |
| Components | shadcn/ui | Accessible, composable, not a heavy dependency |
| API State | TanStack Query (React Query) | Caching, retry, optimistic updates, stale-while-revalidate |
| App State | Zustand | Lightweight, TypeScript-native, zero boilerplate |
| Routing | React Router v6 | Standard, supports URL-based filtering (bookmarkable searches) |
| Tables | TanStack Table | Virtual scrolling, sorting, filtering — handles 100K+ rows |
| Build | Vite | Fast dev server, optimized production builds |
| Testing | Vitest + Testing Library | Fast, React-native testing |

---

## Architecture

```text
┌─────────────────────────────────────────────────┐
│              Orthanc Explorer 3                   │
│           (React SPA — Static Files)              │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │  Study   │ │  Upload  │ │   Settings &   │   │
│  │  List    │ │  Manager │ │   Modalities   │   │
│  ├──────────┤ ├──────────┤ ├────────────────┤   │
│  │  Study   │ │  Worklist│ │   DICOMweb     │   │
│  │  Detail  │ │  Manager │ │   Browser      │   │
│  └────┬─────┘ └────┬─────┘ └───────┬────────┘   │
│       │             │               │             │
│  ┌────┴─────────────┴───────────────┴──────────┐ │
│  │         API Client (TanStack Query)          │ │
│  │  - Orthanc REST API                          │ │
│  │  - DICOMweb (QIDO-RS, WADO-RS, STOW-RS)     │ │
│  │  - Auth (Basic / OIDC / Bearer)              │ │
│  └──────────────────┬──────────────────────────┘ │
└─────────────────────┼────────────────────────────┘
                      │ HTTP
                      ▼
┌─────────────────────────────────────────────────┐
│                   Orthanc                        │
│          (DICOM Server + REST API)               │
└─────────────────────────────────────────────────┘
```

### Deployment Topology

```yaml
# Docker Compose — standard deployment
services:
  orthanc:
    image: orthancteam/orthanc:latest
    ports:
      - "8042:8042"
    volumes:
      - ./orthanc.json:/etc/orthanc/orthanc.json
      - orthanc-data:/var/lib/orthanc/db

  orthanc-ui:
    image: rhavekost/orthanc-explorer-3:latest
    ports:
      - "3000:80"
    environment:
      - ORTHANC_URL=http://orthanc:8042
      - AUTH_MODE=basic  # basic | oidc | none

volumes:
  orthanc-data:
```

```yaml
# Azure Container Apps — sidecar deployment
properties:
  template:
    containers:
      - name: orthanc
        image: orthancteam/orthanc:latest
      - name: orthanc-ui
        image: your-registry.azurecr.io/orthanc-explorer-3:latest
        env:
          - name: ORTHANC_URL
            value: http://localhost:8042
```

---

## Screens & Features

### 1. Study List (Main View)

**OE2 Parity:**

- Search by PatientName, PatientID, StudyDate, AccessionNumber, StudyDescription, ModalitiesInStudy
- Column display configuration
- Labels management (create, assign, filter)
- Quick viewer button per study
- Quick PDF report button per study
- Multi-study selection with bulk actions
- Order by any column

**Enhancements:**

- Virtual scrolling (TanStack Table) — handles 100K+ studies without pagination lag
- Debounced search with URL state (shareable/bookmarkable filters)
- Saved search presets (store in localStorage or Orthanc metadata)
- Real-time new study notifications via Orthanc `/changes` API polling
- Inline column resizing and reordering
- Keyboard navigation (arrow keys, Enter to open, Space to select)
- Date range picker with presets (today, last 7 days, last 30 days, custom)

### 2. Study Detail

**OE2 Parity:**

- Study metadata display (configurable tags)
- Series list with modality, description, instance count
- Series thumbnail preview
- Open in viewer (OHIF, Stone, Weasis, MedDream — configurable)
- Modify study tags, anonymize, download ZIP, share link, send to peer/modality, delete

**Enhancements:**

- Series thumbnails with lazy loading (WADO-RS rendered frames)
- Inline DICOM tag browser with search and human-readable tag names
- Side-by-side study comparison (for follow-up imaging)
- Copy UIDs to clipboard
- Activity log (received, modified, accessed timestamps)

### 3. Upload

**OE2 Parity:** DICOM file upload via browser with upload report

**Enhancements:**

- Drag-and-drop with recursive folder support
- Upload progress bar per file and overall
- Pre-upload validation, duplicate detection
- Upload queue with pause/resume/cancel

### 4. Remote Sources (DICOM & DICOMweb)

**OE2 Parity:** C-FIND query, C-MOVE retrieve, DICOMweb browse and retrieve

**Enhancements:**

- Unified search across local + remote sources
- Connection status indicators, test connection button
- Query history

### 5. Settings & Configuration

**OE2 Parity:** System info, plugin status

**Enhancements:**

- **In-app modality management** (no config file editing!)
- **In-app DICOMweb server management** with connection testing
- Real-time system dashboard (disk, ingestion rate, connections)
- Log viewer, job queue monitoring

### 6. Worklist Management

Clean form-based worklist creation, calendar view, status tracking

### 7. Cross-Cutting UX

**Command Palette (Cmd+K):** Search studies, navigate, run actions

**Keyboard Shortcuts:** `/` focus search, `j/k` navigate, `Enter` open, `Space` select

**Theme:** Dark/light with system detection, custom logo/favicon support

**Accessibility:** WCAG 2.1 AA, screen reader support, focus management

**Responsive:** Desktop-first, tablet-friendly, collapsible sidebar

---

## Orthanc REST API Surface

### Core Endpoints

```text
# System
GET  /system, /statistics, /plugins, /changes

# Studies
GET  /studies, /studies/{id}, /studies/{id}/series, /studies/{id}/statistics
DELETE /studies/{id}
POST /studies/{id}/modify, /studies/{id}/anonymize
GET  /studies/{id}/archive, /studies/{id}/media

# Series & Instances
GET  /series/{id}, /series/{id}/instances
GET  /instances/{id}, /instances/{id}/preview, /instances/{id}/tags

# Search
POST /tools/find, /tools/lookup

# Upload
POST /instances

# Remote Operations
GET  /modalities
POST /modalities/{id}/echo, /modalities/{id}/query
POST /queries/{id}/answers/{n}/retrieve

# DICOMweb
GET  /dicom-web/servers
POST /dicom-web/servers/{id}/qido, /dicom-web/servers/{id}/retrieve, /dicom-web/servers/{id}/stow

# Labels (Orthanc 1.12+)
PUT/DELETE /studies/{id}/labels/{label}

# Jobs
GET  /jobs, /jobs/{id}
```

### DICOMweb Endpoints

```text
GET  /dicom-web/studies?PatientName=Smith*     (QIDO-RS)
GET  /dicom-web/studies/{uid}/series/{uid}/instances/{uid}/rendered  (WADO-RS)
POST /dicom-web/studies                         (STOW-RS)
```

---

## OE2 Config Parity Map

| OE2 Config | OE3 Approach |
|------------|-------------|
| `StudyListColumns` | Column picker in UI |
| `StudyListSearchMode` | User preference toggle |
| `StudyListContentIfNoSearch` | User preference toggle |
| `EnableOpenInOhifViewer3` / viewer URLs | Settings page |
| `EnableAnonymization` / `EnableModification` | Role-based show/hide |
| `EnableDeleteForStudy` / `EnableSendTo` | Role-based show/hide |
| `EnableUpload` | Role-based show/hide |
| `EnableEditLabels` / `AvailableLabels` | Settings page |
| `CustomCssPath` / `CustomLogoUrl` / `CustomTitle` | Settings page: branding |
| Dark/light mode | System preference + toggle |

---

## Execution Timeline

### Weekend Sprint — v0.1

**Day 1 (Saturday):**

- Morning: Generate requirements with Claude → feed to Lovable
- Afternoon: Lovable builds study list, study detail, upload, settings shells
- Evening: Port to VS Code, connect to Orthanc REST API for study list

**Day 2 (Sunday):**

- Morning: Wire up study detail, series list, basic actions
- Afternoon: Upload with drag-drop, basic search/filter
- Evening: Docker container, test against real Orthanc, screen recording

**Deliverable:** Working study list + detail + upload + settings in Docker. Screen recording for forum/LinkedIn.

### Post-Sprint

- Week 1-2: Community feedback, bug fixes, auth support
- Week 3-4: Modality management, remote query/retrieve
- Month 2: DICOMweb browser, worklist, command palette
- Month 3+: Real-time updates, bulk operations, keyboard shortcuts

---

## Community Strategy

**Before building:** Post RFC on Orthanc forum. Frame as complementary to OE2, not replacement.

**On release:** GitHub repo (MIT), Docker image, forum post with screenshots, LinkedIn post.

**Ongoing:** Respond to issues/PRs, monthly forum updates, accept contributions.

---

## Scope Discipline

**OE3 is primarily an admin/management UI with an embedded informational viewer.** It is NOT a diagnostic DICOM workstation. The boundary:

- **OE3 owns:** Study management, search, upload, modality config, settings, SMART on FHIR launch, drag-and-drop series browsing, and an embedded Cornerstone3D-based viewer for informational review (scroll, W/L, zoom/pan, cine, multi-panel layout).
- **OE3 delegates:** Primary diagnostic interpretation to external viewers (OHIF, institutional cleared viewers) via "Open in Full Viewer" escape hatch.
- **The existing `MultiSeriesViewer` component** (already built for ResonAit, ~750 lines) provides the UI framework. OE3 adaptation swaps the rendering backend to Cornerstone3D for proper DICOM pixel data handling. See [Existing Viewer Framework](#existing-viewer-framework--multiseriesviewer-component) below.
- **FDA positioning:** Informational/research/reference use. Not cleared, not intended for diagnostic reads. Disclaimer in README, about dialog, and docs.

**Time boundaries:** 4-6 hours/week max until consulting income is stable. Ship v0.1 fast. Track time against ResonAit/Bridge Dental.

---

## References

- [Orthanc REST API Docs](https://orthanc.uclouvain.be/book/users/rest.html)
- [Orthanc Explorer 2 GitHub](https://github.com/orthanc-server/orthanc-explorer-2)
- [OE2 Plugin Docs](https://orthanc.uclouvain.be/book/plugins/orthanc-explorer-2.html)
- [Orthanc DICOMweb Plugin](https://orthanc.uclouvain.be/book/plugins/dicomweb.html)
- [OHIF Viewer](https://github.com/OHIF/Viewers)
- [Orthanc Tools JS](https://github.com/salimkanoun/Orthanc-Tools-JS)
- [OE2 Feature Request Thread](https://groups.google.com/g/orthanc-users/c/oOyKTmfs-J0)
- [Lovable.dev](https://lovable.dev)
- [[The Notes/Projects/Orthanc Improvements/Azure-DICOMweb-OAuth-Plugin]] — Companion project

---

## Prior Art: Orthanc Tools JS (Archived)

**Repo:** [salimkanoun/Orthanc-Tools-JS](https://github.com/salimkanoun/Orthanc-Tools-JS)
**Status:** Archived August 19, 2025. Read-only.
**Stats:** 87 stars, 39 forks, 2,306 commits, 18 open issues at archive time.
**License:** AGPL-3.0 (viral — cannot borrow code for MIT project)

### What They Built

React + Bootstrap frontend with a full Node.js/Express backend acting as reverse proxy between UI and Orthanc. Added auth (local users + Active Directory), role management, batch processing, and automatic retrieval scheduling. Author: Salim Kanoun, nuclear medicine physician in Toulouse (Pixilib company). Also maintains GaelO clinical trial platform, which likely consumed his bandwidth.

### Why It Died — Deployment Complexity

Their docker-compose required 4-5 containers: the app, PostgreSQL (users/roles/settings), Redis (sessions), Traefik reverse proxy, plus Orthanc itself. Compare to OE2 which is a single config option in Orthanc. Forum users were asking "how do I even install this?"

The Node.js backend was the core architectural mistake. Every Orthanc API endpoint had to be re-implemented as a backend route, creating a massive maintenance surface a part-time maintainer couldn't sustain. In May 2023 they announced a frontend rewrite ("The Reborn"). Two years later: archived.

### Lessons for OE3

1. **No backend server.** Pure SPA talking directly to Orthanc REST API. Auth delegated to Orthanc's built-in mechanisms. Zero additional infrastructure. `docker run` and point at Orthanc.

2. **Don't own auth.** They built local user management + AD integration into their backend — that's a product, not a tool. OE3 delegates auth entirely (Basic auth, Authorization plugin, Keycloak/OIDC).

3. **Rewrites kill projects.** Their 2023 "reborn" rewrite → 2025 archive. The Lovable → Claude Code pipeline sidesteps this by generating working v0.1 in a weekend.

4. **`tools/find` limitations are real.** No ORDER BY, no pagination offset, no OR queries in Orthanc's search API. Workaround: client-side sort/filter of returned results — exactly what TanStack Table with virtual scrolling handles well. Must be smart about query limits and caching.

5. **Modality config is now possible via API.** Salim said in-app modality management was impossible because config required file edits + restart. Since then, Orthanc added `DicomModalitiesInDatabase` and `OrthancPeersInDatabase` (v1.5.0+) — stores modalities in DB, exposes via REST. In-app modality management IS feasible now.

### What to Study (Not Copy — AGPL License)

The repo is public and readable as a reference implementation. Worth examining:

- Orthanc API call patterns (their service layer)
- Anonymization/modification UI flows — complex DICOM operations with edge cases
- Batch processing job queue pattern
- DICOM tag display components

**Do not copy code** — AGPL-3.0 is viral and incompatible with MIT licensing.

### Strategic Takeaway

87 stars in the Orthanc niche proves real demand. The project's failure proves deployment complexity and full-stack maintenance burden kills adoption. OE3's "pure SPA sidecar" architecture dodges the exact bullet that killed this project.

---

## Progress Log

### 2026-02-07 — Lovable Scaffolding Complete

Lovable has generated working UI shells for the core screens. Screenshots captured. All mock data — no API integration yet.

**Completed Scaffolding (Lovable output):**

- ✅ **Study List** — sortable table with Patient Name, Study Date, Modality, Description, Series/image counts. Color-coded modality badges (CT=blue, CR=gold, MR=teal, PT=red). Search bar, Filters dropdown. Checkbox multi-select. "120 studies found" count.
- ✅ **Study/Series Detail** — breadcrumb nav (Studies → Patient → Series). Action bar (Viewer, Download, Send, Modify, Anonymize, Delete). Series Info card with metadata. Instance list with grid/list toggle. SOP Instance UID and SOP Class columns.
- ✅ **Activity Timeline** — unified jobs/audit/system log view. Filter tabs (83 events, 32 jobs, 24 audit, 27 system). Error count badge (7 errors). Search + type/severity filters. Slide-out detail panel with timestamp, category, action, metadata, Job ID, status.
- ✅ **Navigation** — left sidebar (Studies, Upload, Activity, Remote Sources, Settings). Tab bar for open studies (IDE-style, with close buttons). Demo Mode toggle. Version/license footer.
- ✅ **Job Manager** — persistent bottom dock across all views. Shows running/completed jobs with type icons (anonymize, upload, send). "Clear completed" action. Expandable/collapsible.

**Still Needs (API Integration Phase — Claude Code):**

- [ ] Wire study list to `POST /tools/find` and `GET /studies`
- [ ] Wire series/instance views to `GET /studies/{id}/series` and series endpoints
- [ ] Real search with debounce hitting Orthanc API
- [ ] Upload page with drag-drop → `POST /instances`
- [ ] Activity timeline → `GET /changes` polling
- [ ] Job manager → `GET /jobs` polling
- [ ] Remote Sources page (modality management, C-FIND, C-MOVE)
- [ ] Settings page (system info, plugin status, modality config via API)
- [ ] Auth flow (Basic auth header, OIDC token passthrough)
- [ ] Action handlers (Send, Modify, Anonymize, Delete, Download ZIP)
- [ ] Docker containerization

### Settings Runtime Behavior

**Live-editable (no restart, stored in DB via REST API):**

- DICOM Modalities — requires `DicomModalitiesInDatabase: true` in orthanc.json. Then `PUT /modalities/{name}` and `DELETE /modalities/{name}` work at runtime. The Add Modality dialog (Name, AET, Port, Host, Manufacturer) maps directly to this API.
- Orthanc Peers — requires `OrthancPeersInDatabase: true`. Same pattern via `PUT /peers/{name}`.
- DICOMweb Servers — `PUT /dicom-web/servers/{name}` works at runtime when DICOMweb plugin is loaded.

**Restart required:**

- Core Orthanc config (ports, storage paths, plugin loading, SSL)
- Plugin-level config (e.g., `DicomWebOAuth` section in orthanc.json)
- Any setting that lives in orthanc.json and isn't backed by a `*InDatabase` flag

**UX implications:**

- Modalities tab, DICOMweb tab: full CRUD in the UI, instant effect. No restart banner needed.
- OAuth plugin config (client ID, secret, token endpoint): one-time setup in orthanc.json or env vars. Could show read-only status in UI ("OAuth configured for: Azure Health Data Services") but editing requires config file change + restart.
- Preferences tab (branding, theme): these are OE3-local settings stored in browser localStorage or a sidecar config — no Orthanc restart involved.
- System tab: read-only display of Orthanc system info (`GET /system`), plugin list (`GET /plugins`), storage stats. No restart implications.

**Implementation notes:**

- Settings → Modalities: wire to `GET /modalities`, `PUT /modalities/{name}`, `DELETE /modalities/{name}`
- Settings → DICOMweb: wire to `GET /dicom-web/servers`, `PUT /dicom-web/servers/{name}`, `DELETE /dicom-web/servers/{name}`
- Add Modality dialog fields map to Orthanc modality config: `{ "AET": "CT_MAIN", "Host": "192.168.1.10", "Port": 104, "Manufacturer": "Siemens" }`
- Add DICOMweb Server dialog: Name, URL, Auth type (None/Basic/Bearer/OAuth 2.0), capabilities toggles (QIDO/WADO/STOW)
- C-Echo test button on modality rows → `POST /modalities/{name}/echo`

### Auth Display (Adaptive User Badge)

**Principle:** OE3 never owns auth. It only displays identity when the environment provides it.

**Behavior:**

- Top-right corner of the header bar, left of any settings/help icons
- Displays authenticated username when available
- Does NOT render when no auth context is detected
- No login form, no user management, no session handling

**Detection strategy (check in order):**

1. **JWT in Authorization header** — decode payload, extract `preferred_username` or `sub` claim. Common with Keycloak/OIDC via orthanc-auth-service.
2. **Proxy headers** — check for `X-Remote-User`, `X-Forwarded-User`, or similar headers injected by reverse proxy (Nginx, Traefik, Azure Front Door).
3. **Orthanc Authorization Plugin** — detect via `GET /plugins` whether authorization plugin is active. If so, attempt to read user info from token.
4. **No auth detected** — hide the badge entirely. No error, no placeholder.

**UI component:**

- Avatar circle with initials (derived from username) + username text
- Click → dropdown menu with:
  - Username / email (read-only display)
  - Role if available from JWT claims
  - "About Orthanc Explorer 3" link
  - Logout (only if OIDC — redirects to IdP logout endpoint)
- Subtle — should not dominate the header

**Why this matters:**

- Production deployments behind SSO expect to see "who am I" confirmation
- Builds admin trust without adding auth complexity
- Reinforces that OE3 is enterprise-ready
- Zero friction for no-auth lab/dev setups — component simply doesn't appear

### SMART on FHIR / EHR Integration (Future Phase)

New document created: [[smart-on-fhir-integration]]

**Summary:** OE3 can implement SMART on FHIR EHR launch to embed as a PACS viewer inside Epic, Oracle Health (Cerner), and other SMART-enabled EHRs. The entire integration lives in the OE3 frontend — Orthanc requires zero modifications. Uses the `fhirclient` npm library for the OAuth2 handshake.

**Key insight:** No other Orthanc frontend offers this. It's a unique differentiator.

**Testing path:** Free sandboxes exist at every tier:

- SMART App Launcher (<https://launch.smarthealthit.org>) — no registration, start immediately
- Epic sandbox (<https://open.epic.com>) — free dev account
- Oracle Health code Console — free CernerCare account
- Docker-based local sandbox available

---

## FDA Regulatory Positioning

### The Regulatory Landscape

The FDA classifies DICOM viewers intended for **diagnostic interpretation** as Class II medical devices under regulation 892.2020 (PACS) or 892.2050 (display devices), requiring 510(k) premarket notification. The critical factor is **intended use** — it's what you *claim* the software does, not what it technically *can* do.

**If intended for primary diagnosis:** 510(k) required. Class II device. Requires Quality Management System (ISO 13485), design controls, software lifecycle per IEC 62304, risk management per ISO 14971, clinical testing for substantial equivalence, cybersecurity documentation, and ongoing post-market surveillance. First-time submission typically costs $50K-$150K+ in regulatory consulting plus months of documentation.

**If intended for informational/research/reference use:** Not subject to 510(k). This is how every major open-source viewer operates.

### How Open-Source Projects Handle This

| Project | FDA Status | Approach |
|---------|-----------|----------|
| **OHIF Viewer** | Not cleared itself | Framework. States it "has served as the basis for many active, production, and FDA Cleared medical imaging viewers." Others take OHIF, wrap it in their own QMS, and submit for 510(k). |
| **Radical Imaging FlexView** | Pursuing 510(k) | Commercial product built on OHIF. Submitting 510(k) for "FlexView Diagnostic" — "so you don't have to!" Non-diagnostic version also planned. |
| **OsiriX** | Free version not cleared | OsiriX MD is FDA cleared (K101342), Class II. Costs ~$700+/license. Free OsiriX carries "not for diagnostic use" disclaimer. |
| **3D Slicer** | Not cleared | Research platform. "Not intended for clinical use." |
| **Horos** | Not cleared | Carries standard disclaimer. |

### OE3's Position: Clean Regulatory Boundary

OE3 is primarily a **study management and navigation interface**, not a diagnostic viewer. It:

- Manages study lists, searches, uploads, modality configuration
- Handles SMART on FHIR launch and patient context
- Provides settings, audit, and admin functionality
- Includes an **embedded informational viewer** (Cornerstone3D) for quick image review — scroll, W/L, zoom, multi-panel layout
- **Delegates diagnostic viewing** to external viewers (OHIF, institutional cleared viewers) via "Open in Full Viewer"

**Required disclaimer (README, about dialog, documentation):**

> *"Orthanc Explorer 3 is intended for informational, research, and administrative purposes. It is not FDA cleared and is not intended for primary diagnostic interpretation of medical images. Organizations requiring FDA-cleared diagnostic viewing should use an appropriately cleared viewer application."*

### Viewer Architecture: Dual Strategy

**Standalone mode:**

- Study browser → click study → launches OHIF (or configured viewer) in new tab
- Same pattern as OE2. User chooses their viewer.

**Embedded EHR mode (SMART on FHIR):**

- Embed **Cornerstone3D** directly as a React component for inline image viewing
- Cornerstone3D is the rendering engine underneath OHIF — same image quality, but used as a library rather than a full application
- Supports: scroll, window/level, zoom/pan, basic measurements
- Clinical context: referring physicians checking studies, ER docs glancing at images, surgeons reviewing pre-op — NOT primary diagnostic reads
- "Open in Full Viewer" escape hatch → launches OHIF/institutional viewer in new tab for radiologists who need full diagnostic tooling

**Why Cornerstone3D, not embedded OHIF:**

- OHIF is a complete SPA — its own routing, state management, study list, config system
- Embedding one SPA inside another SPA inside an EHR iframe = routing conflicts, state collisions, CSS conflicts
- Cornerstone3D as a library integrates cleanly into OE3's React component tree
- ~200-300 lines of React wrapper for a functional viewport
- Same rendering engine, zero architecture conflicts

**Libraries:**

- `@cornerstonejs/core` — rendering engine
- `@cornerstonejs/streaming-image-volume-loader` — DICOMweb image loading
- `@cornerstonejs/tools` — interaction tools (W/L, zoom, pan, scroll, measurements)
- All TypeScript, MIT licensed, maintained by Radical Imaging / OHIF community
- Supports WADO-RS natively (exactly what Orthanc's DICOMweb plugin serves)

**FDA angle remains clean:** OE3 with embedded Cornerstone3D in informational/review mode is clearly not a diagnostic workstation. The "Open in Full Viewer" button explicitly delegates diagnostic viewing to whatever the institution has cleared. Clean intended use separation.

### Consulting Opportunity

OE3's architecture could make it *easier* for organizations to get 510(k) clearance on a viewer built with it:

- EHR launch infrastructure (SMART on FHIR) already built
- Patient context management handled
- Audit trail available (with ATNA plugin)
- Access control enforced (with ACL plugin)
- A company could take OE3, swap in their own validated/cleared viewer component, and have a regulatory-ready deployment

This is a consulting engagement: helping organizations navigate the regulatory path while using open-source infrastructure for everything except the cleared viewer component.

### For the Research Paper

The paper describes **workflow integration and infrastructure**, not diagnostic capability. The security architecture, SMART launch protocol, and OAuth2 pipeline are all infrastructure-level contributions. The paper should note the intended use boundary and the deliberate separation of workflow orchestration (OE3) from diagnostic viewing (delegated to cleared viewers). This keeps the paper focused on the novel contributions without regulatory complications.

---

## Existing Viewer Framework — MultiSeriesViewer Component

### Already Built

A fully functional 4-panel DICOM viewer already exists in the ResonAit codebase (`MultiSeriesViewer.tsx`). This component provides the exact UI framework that would need to be built around Cornerstone3D — meaning the OE3 embedded viewer is primarily an adaptation project, not a greenfield build.

### Current Capabilities

**Layout & Navigation:**

- 4-panel grid (2×2) with maximize/restore per panel (double-click or button)
- Layout mode toggle: grid ↔ single maximized panel
- Drag-and-drop series into viewports with visual highlighting per panel
- Empty state prompts ("Drag & drop a series here")

**Scrolling & Sync:**

- Individual per-viewport sliders
- Synchronized scrolling via master slider (normalized 0-100% so series of different lengths stay proportional)
- Mouse wheel scrolling (linked or independent based on sync mode)

**Tools:**

- Window/Level adjustment (drag left/right = contrast, up/down = brightness)
- Pan tool (drag to move image)
- Zoom tool (drag up/down)
- Tool mode selector in toolbar (W/L, Pan, Zoom)
- W/L presets: soft tissue, bone, lung, brain
- Reset per-viewport and reset-all

**Cine Playback:**

- Play/pause with auto-advance
- Speed control (0.5x, 1x, 2x)
- Loops back to start

**Loading & Performance:**

- Progressive loading: first image loads immediately (user sees something fast), remaining images stream in background
- Loading counter overlay ("Loading 12/45")
- Full loading overlay for initial load, corner indicator for background loading

**Viewport Info Overlay:**

- Modality, series number, slice position (e.g., "23 / 145")
- W/L values, zoom percentage
- Series description

**Touch Support:**

- Full touch event handling for iPad
- Touch-friendly button sizing (min 44px)
- Safe area inset handling for slider positioning

**Responsive:**

- ResizeObserver-based canvas sizing via `useContainerSize` hook
- Dynamic canvas dimensions for grid vs maximized modes
- Redraws on container resize

### Current Rendering Approach

The component renders to raw HTML `<canvas>` elements, loading pre-rendered PNG frames from a ResonAit-specific API endpoint:

```text
GET /dicomimage/instances/{id}/rendered?viewport=600,600&quality=70
```

Window/level is applied via manual `getImageData`/`putImageData` pixel manipulation — a brightness/contrast approximation that works for rendered frames but isn't true DICOM windowing (which operates on 16-bit Hounsfield units with proper VOI LUT math).

### Adaptation Plan for OE3

**What stays (reuse as-is):**

- Entire layout system (grid, maximize, responsive sizing)
- Toolbar (tool selector, playback controls, sync toggle, layout selector, help modal)
- Drag-and-drop logic
- Synchronized scrolling with master slider
- Cine player
- Touch event handling
- Viewport info overlay
- Loading state management and progressive loading UX

**What changes (swap rendering backend):**

| Current (ResonAit) | OE3 (Cornerstone3D) |
|---------------------|---------------------|
| Raw `<canvas>` with manual `drawImage` | Cornerstone3D `RenderingEngine` + `StackViewport` per panel |
| Pre-rendered PNGs from custom API | WADO-RS raw DICOM from Orthanc DICOMweb |
| `getImageData`/`putImageData` W/L approximation | Native DICOM W/L (16-bit, VOI LUT, proper Hounsfield units) |
| Manual zoom/pan via canvas transforms | Cornerstone3D native viewport controls |
| Custom sync logic | Cornerstone3D `SynchronizerManager` API |
| `apiClient.get(/dicomimage/...)` | `cornerstoneStreamingImageVolumeLoader` with WADO-RS |

**Estimated effort:** One weekend of integration work. The hard part (UI framework, interaction model, layout system) is done. The remaining work is plumbing Cornerstone3D's API into the existing component structure.

### Implications

- OE3's embedded viewer is **not** a from-scratch build — it's an adaptation of proven, working code
- The paper can reference this as a mature component with real clinical usage at ResonAit
- The Cornerstone3D swap adds proper DICOM rendering without losing any existing UX
- The component already supports the embedded EHR use case (compact, self-contained, touch-friendly)
