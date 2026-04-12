---
status: planning
tags:
  - orthanc
  - open-source
  - dicom
  - healthcare-it
  - plugins
  - enterprise
  - pacs
date: 2026-02-07T00:00:00.000Z
last_updated: '2026-02-07T13:45:00-06:00'
---

# Enterprise Plugin Roadmap — Closing the 80→100% Gap

Orthanc + PostgreSQL delivers roughly 80% of commercial PACS capability. The remaining 20% is a set of well-defined gaps that prevent Orthanc from being defensible in real procurement conversations. Each gap below is a plugin or system opportunity — most are Python plugins, some are OE3 UI features, some are sidecar services.

**Strategic thesis:** You don't need to build all of these. Ship 2-3 critical ones alongside OE3 + OAuth + SMART launch, and you define the platform others build on. The combined pitch becomes a reference architecture for open-source clinical imaging that's actually deployable.

## Orthanc Production Readiness — Current State

**What's proven at scale:**
- 65TB+ data, 340K studies, 150M instances in production hospitals
- Malaysian hospital (608 beds, CR/US/MG/CT/MR/RF) running Orthanc as sole PACS with zero funding
- Donka University Hospital (Guinea) selected Orthanc after formal open-source PACS assessment
- PostgreSQL plugin supports multiple writers, load balancing, Kubernetes replicas
- AWS Marketplace listing with S3 storage integration

**What makes commercial PACS worth $200K+:**
- HL7/ADT integration (patient sync, orders)
- Study-level access control (per-physician, per-department)
- IHE ATNA audit trails (HIPAA compliance)
- Intelligent prior study prefetching
- Worklist management with scheduling UI
- Disaster recovery / site replication
- Radiation dose monitoring and reporting

---

## Plugin Opportunities

### 1. 🔴 HL7/ADT Integration — CRITICAL

**The gap:** When a patient gets registered or an order is placed in the HIS/RIS, the PACS needs to know. Commercial PACS receive HL7 ADT (patient registration/update) and ORM (order) messages natively. Orthanc has zero HL7 awareness.

**What it does:**
- Listen for HL7v2 messages via TCP/MLLP (standard healthcare transport)
- Receive ADT messages → update Orthanc patient demographics automatically
- Receive ORM messages → create worklist entries from orders
- Optionally support FHIR Subscriptions as modern alternative
- Acknowledge messages per HL7 protocol (ACK/NAK)

**Architecture options:**
1. **Python plugin (embedded):** Use `python-hl7` or `hl7apy` library, run MLLP listener in a thread. Tight integration, no extra deployment. Risk: MLLP is TCP-based and long-lived connections in a plugin thread could be fragile.
2. **Sidecar service:** Standalone Python/Node service running Mirth Connect or custom MLLP listener, pushes parsed data to Orthanc REST API. More robust, standard healthcare integration pattern. Adds deployment complexity.
3. **FHIR-native:** Skip HL7v2 entirely, subscribe to FHIR Patient/ServiceRequest resources. Modern but requires the HIS/EHR to expose FHIR (Epic does, many others don't yet).

**Recommended approach:** Sidecar with Docker Compose bundling. Keeps Orthanc core clean, follows healthcare integration engine pattern (Mirth, Rhapsody, etc.). Provide a lightweight Python MLLP listener that translates HL7→Orthanc REST calls. Include a FHIR Subscription mode for modern deployments.

**Pairs with:** SMART on FHIR (FHIR ecosystem), Worklist Management (#5)

**Effort:** Medium (2-3 weekends for v1)
**Impact:** Single biggest gap for clinical deployment

**Libraries:**
- `python-hl7` — HL7v2 message parsing
- `hl7apy` — more comprehensive HL7v2 library with message building
- `aiohttp` or `asyncio` for MLLP listener
- Mirth Connect (open source) as alternative if full integration engine needed

---

### 2. 🔴 Study-Level Access Control — CRITICAL

**The gap:** Orthanc's existing authorization plugin does basic role-based access. Clinical deployments need granular control: referring physician sees only their patients, ED sees only their department's studies, break-the-glass access for emergencies with full audit logging.

**What it does:**
- Intercept every REST API and DICOMweb request
- Check authenticated user against access policy before returning results
- Filter study lists to only show authorized studies
- Support multiple policy modes:
  - **Patient-bound:** User X can only see Patient Y's studies (SMART on FHIR token already carries this)
  - **Department-bound:** Radiology sees all, Cardiology sees cardiac, ED sees ED
  - **Referring physician:** Only see studies you ordered or were CC'd on
  - **Break-the-glass:** Emergency override with mandatory reason logging
- Provide admin UI in OE3 for policy management

**Architecture:**
- Python plugin hooking into `IncomingHttpRequestFilter` and `OnStoredInstance`
- Policy store: PostgreSQL table or FHIR-based (AccessPolicy resources)
- LDAP/AD group mapping for department-based access
- SMART on FHIR token enforcement (embedded EHR view only returns launched patient's studies)

**Security selling point:** In embedded EHR mode, the SMART token constrains the view by design. The access control plugin enforces this server-side, not just client-side. Defense in depth.

**Effort:** Medium (2-3 weekends)
**Impact:** Required for any multi-user clinical deployment

---

### 3. 🔴 IHE ATNA Audit Trail — CRITICAL FOR COMPLIANCE

**The gap:** HIPAA requires audit trails. IHE's ATNA (Audit Trail and Node Authentication) profile defines the standard format. Every DICOM operation, REST API access, and image view must be logged in a structured, tamper-evident format. Orthanc logs access but has no IHE-compliant audit repository.

**What it does:**
- Hook into Orthanc's `OnChange` callbacks and HTTP request lifecycle
- Generate RFC 3881 / DICOM Supplement 95 audit messages for:
  - Patient record access (who viewed what, when)
  - Study import/export
  - DICOM associations (C-STORE, C-FIND, C-MOVE)
  - Configuration changes
  - Authentication events (login, failed login, break-the-glass)
- Ship audit messages to:
  - Syslog server (standard ATNA transport)
  - Elasticsearch (modern, searchable)
  - FHIR AuditEvent resources (R4 standard)
  - PostgreSQL audit table (simple, queryable)
- Provide audit viewer in OE3 (searchable log with filters)

**Why this matters for procurement:** When a PACS administrator gets asked "show me your audit trail" during Joint Commission / ACR accreditation, they currently have nothing standardized to point to. This plugin makes that conversation possible.

**Effort:** Low-Medium (1-2 weekends for core, more for UI)
**Impact:** Compliance checkbox that unlocks regulated environments

**Spec references:**
- IHE ITI TF-1 Section 9 (ATNA profile)
- RFC 3881 (Security Audit and Access Accountability)
- DICOM PS3.15 Annex A (Audit Trail Message Format)
- FHIR R4 AuditEvent resource

---

### 4. 🟡 Intelligent Prior Study Prefetch — HIGH VALUE

**The gap:** When a new study arrives, commercial PACS automatically fetch relevant prior studies from the archive (or from federated external sources). Radiologist opens a chest CT and the last 3 chest CTs are already cached locally. Orthanc has no prefetch intelligence.

**What it does:**
- Watch `OnStableStudy` callback for new arrivals
- Analyze incoming study: body part, modality, clinical context
- Query Orthanc (and/or federated DICOMweb sources via OAuth plugin) for matching priors:
  - Same patient + same body part + same modality + last N studies
  - Configurable rules engine for institution-specific logic
- Prefetch priors into local Orthanc cache asynchronously
- Track prefetch status (OE3 could show "3 priors available" badge)

**Compound value with OAuth plugin:** Prefetch priors from cloud PACS using authenticated DICOMweb queries. Nobody has this in open source. The full chain: new study arrives locally → plugin queries Azure Health Data Services via OAuth → fetches matching priors → cached locally before radiologist opens viewer.

**Advanced option:** ML-based prediction of which priors the radiologist will want based on order type, referring physician patterns, and clinical history. But even simple rule-based matching is a massive workflow improvement.

**Effort:** Medium (2 weekends for rule-based, more for ML)
**Impact:** Direct radiologist productivity improvement

---

### 5. 🟡 Worklist Management — HIGH VALUE, OE3 FEATURE

**The gap:** The worklist plugin exists but reads from flat files on disk. There's no integrated scheduling UI, no REST API for worklist CRUD, no connection between orders and scheduled procedures.

**What it does:**
- REST API layer over Orthanc's worklist plugin (create/update/delete worklist items)
- OE3 Worklist tab showing today's scheduled exams
- Status tracking: Scheduled → In Progress → Completed
- Auto-complete when matching study arrives (correlate by AccessionNumber or ScheduledProcedureStepID)
- Integration with HL7 ORM messages (ties to Plugin #1)
- Technologist view: "Here's your next patient, Room 2, Chest CT"

**Architecture:**
- Backend: Python plugin providing REST endpoints for worklist CRUD, writing to the file-based worklist plugin format (or replacing it entirely with a PostgreSQL-backed worklist store)
- Frontend: OE3 Worklist tab with daily schedule view, drag-to-reorder, status toggles
- Integration: HL7 ORM → worklist entry creation (via Plugin #1)

**Effort:** Low-Medium (1-2 weekends for API + basic OE3 tab)
**Impact:** Completes the clinical workflow loop

---

### 6. 🟡 Disaster Recovery / Replication — HIGH VALUE FOR ENTERPRISE

**The gap:** Commercial PACS ship with site-to-site replication, automated failover, and backup verification. Orthanc has the Transfers Accelerator plugin for peer-to-peer transfer, but no automated replication engine.

**What it does:**
- Watch `OnStableStudy` for new arrivals
- Queue asynchronous replication jobs to configured targets:
  - Orthanc peer (via Orthanc peering API)
  - DICOMweb endpoint (via STOW-RS, uses OAuth plugin for auth)
  - S3/Azure Blob (for cold archive)
- Track replication status per study (replicated, pending, failed, retrying)
- Alert on replication failures (webhook, email)
- OE3 dashboard showing replication lag, queue depth, failure count
- Verification: periodic integrity checks comparing source and target study counts/checksums

**Combined with PostgreSQL streaming replication** for the database index, this gives a real DR story: database replicates via PostgreSQL, DICOM files replicate via this plugin, RTO/RPO metrics become quantifiable.

**Effort:** Medium (2-3 weekends)
**Impact:** Enterprise procurement requirement

---

### 7. 🟢 Radiation Dose Monitoring — NICHE BUT REGULATORY

**The gap:** Many countries/states now require tracking and reporting radiation dose (EU Directive 2013/59/Euratom, California SB 1237, etc.). DICOM Radiation Dose Structured Reports (RDSR) contain this data but nobody aggregates it.

**What it does:**
- Parse incoming DICOM RDSR objects (Structured Report IOD)
- Extract dose metrics: CTDIvol, DLP, DAP, fluoroscopy time
- Aggregate dose per patient across all studies
- Alert when cumulative dose exceeds configurable thresholds
- Reporting dashboard in OE3: dose trends, outlier detection, per-modality statistics
- Export reports for regulatory compliance

**Effort:** Low (1-2 weekends)
**Impact:** Regulatory compliance checkbox, particularly EU and California

---

## Priority Matrix

| # | Plugin | Priority | Effort | Dependencies |
|---|--------|----------|--------|-------------|
| 1 | HL7/ADT Integration | 🔴 Critical | Medium | python-hl7, sidecar pattern |
| 2 | Study-Level ACL | 🔴 Critical | Medium | Auth plugin foundation, LDAP |
| 3 | IHE ATNA Audit | 🔴 Critical | Low-Med | Syslog, RFC 3881 spec |
| 4 | Intelligent Prefetch | 🟡 High | Medium | OAuth plugin (federated) |
| 5 | Worklist Management | 🟡 High | Low-Med | OE3 UI, HL7 plugin (#1) |
| 6 | DR / Replication | 🟡 High | Medium | Transfers plugin, S3/Blob |
| 7 | Dose Monitoring | 🟢 Nice-to-have | Low | RDSR parsing |

## Recommended Build Order

**Phase 1 — Foundation (current):**
- orthanc-dicomweb-oauth ✅ (in progress)
- Orthanc Explorer 3 ✅ (in progress)
- SMART on FHIR launch (planned)

**Phase 2 — Compliance unlocks:**
- IHE ATNA Audit (#3) — lowest effort, highest compliance impact
- Study-Level ACL (#2) — required for multi-user deployments

**Phase 3 — Clinical workflow:**
- HL7/ADT Integration (#1) — biggest single gap
- Worklist Management (#5) — completes the workflow loop

**Phase 4 — Enterprise features:**
- Intelligent Prefetch (#4) — showcases OAuth plugin compound value
- DR / Replication (#6) — enterprise procurement checkbox

**Phase 5 — Specialty:**
- Dose Monitoring (#7) — regulatory compliance, lower priority

## The Combined Story

With Phase 1-3 complete, the pitch becomes:

> "Orthanc + OE3 + OAuth + SMART + ATNA + ACL + HL7 = an open-source PACS stack that integrates with your EHR, authenticates against your cloud PACS, enforces study-level access control, maintains HIPAA-compliant audit trails, and syncs with your HIS. All MIT-licensed, all Docker-deployable, all documented."

That's not "80% of commercial PACS." That's a legitimate alternative for the right deployment profile — and it's a story that gets published, gets conference talks, and generates consulting inbound.

## Related

- [[The Notes/Projects/Orthanc Improvements/orthanc-dicomweb-oauth]] — OAuth2 plugin (Phase 1)
- [[The Notes/Projects/Orthanc Improvements/Orthanc-Explorer-3]] — Modern UI (Phase 1)
- [[The Notes/Projects/Orthanc Improvements/smart-on-fhir-integration]] — EHR launch (Phase 1)
- [[The Notes/Projects/Orthanc Improvements/README]] — Project index


---

## FDA Regulatory Note

All plugins and features in this roadmap are **infrastructure and workflow components**, not diagnostic viewing software. They do not require FDA 510(k) clearance because their intended use is administrative, operational, and informational — not primary diagnostic interpretation.

The critical regulatory boundary: OE3 delegates diagnostic viewing to external viewers (OHIF, Cornerstone3D for informational use, or the institution's FDA-cleared viewer). This separation must be maintained in all plugin designs — none of these plugins should make diagnostic claims or modify image pixel data for diagnostic purposes.

See: [[Orthanc-Explorer-3#FDA Regulatory Positioning]] for full regulatory analysis including the OsiriX/OHIF/FlexView precedents.
