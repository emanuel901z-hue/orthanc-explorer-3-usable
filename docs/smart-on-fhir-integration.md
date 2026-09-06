---
title: SMART on FHIR / EHR Integration
status: research
tags:
  - orthanc
  - smart-on-fhir
  - fhir
  - ehr
  - epic
  - cerner
  - dicom
  - interoperability
  - research-paper
  - siim
  - healthinf
  - oauth2
  - azure-managed-identity
  - security
  - cloud-pacs
date: 2026-02-07T00:00:00.000Z
last_updated: '2026-02-07T13:45:00-06:00'
phase: future
parent: '[[README]]'
---

# SMART on FHIR — EHR-Embedded PACS Viewer via Orthanc Explorer 3

## Executive Summary

SMART on FHIR (Substitutable Medical Apps, Reusable Technologies) is the open standard for embedding third-party applications inside EHR systems. By implementing SMART launch support in OE3, clinicians could open a PACS viewer directly within Epic, Oracle Health (Cerner), MEDITECH, or any SMART-enabled EHR — without leaving their workflow.

**The key architectural insight:** This integration lives entirely in OE3's frontend. Orthanc itself requires zero modifications. SMART on FHIR is an OAuth2-based browser protocol; OE3 handles the launch handshake, receives patient context, and queries Orthanc's existing REST API filtered to that patient. Orthanc never knows FHIR exists.

## Why This Matters

### Clinical Workflow

- Clinician opens a patient chart in Epic → clicks "Imaging" → OE3 opens inline showing that patient's studies
- No context switching, no separate login, no copy-pasting MRNs
- Studies are immediately scoped to the right patient

### Strategic Positioning

- Differentiates OE3 from every other Orthanc frontend (OE2, Orthanc Tools JS, etc.)
- Signals enterprise readiness even before first production deployment
- Opens consulting opportunities: "I can embed your PACS inside your EHR"
- Aligns with 21st Century Cures Act information blocking rules (§171.301) — health systems must support standardized API access

### Market Context

- Epic holds ~38% of US hospital market share
- Oracle Health (Cerner) holds ~25%
- Both require SMART on FHIR for third-party app integration
- Epic's App Orchard (now "Showroom") and Oracle's code Console are the distribution channels

---

## Architecture

### How SMART on FHIR Works (EHR Launch Flow)

```text
┌─────────────┐     1. Launch URL + params      ┌──────────────┐
│   EHR        │ ──────────────────────────────→ │  OE3         │
│ (Epic, etc.) │     ?iss=...&launch=abc123      │  /launch     │
└─────────────┘                                  └──────┬───────┘
                                                        │
                  2. Redirect to authorize endpoint     │
┌─────────────┐ ←───────────────────────────────────────┘
│  EHR Auth    │
│  Server      │  3. User already authenticated in EHR
│              │     → silent redirect back with auth code
└──────┬──────┘
       │
       │  4. Redirect to OE3 /callback?code=xyz
       ▼
┌──────────────┐  5. Exchange code for access token (PKCE)
│  OE3         │     Token response includes:
│  /callback   │     - access_token (for FHIR API)
│              │     - patient: "fhir-patient-id-123"
└──────┬───────┘     - id_token (user identity)
       │
       │  6. Use patient context to get MRN
       │     GET {fhir-server}/Patient/{id} → extract MRN from identifiers
       ▼
┌──────────────┐  7. Query Orthanc filtered by PatientID (MRN)
│  OE3 App     │     POST /tools/find { "Level":"Study", "Query":{"PatientID":"206919"} }
│  (study list │
│   + viewer)  │  8. Display studies → user clicks → viewer loads via DICOMweb
└──────────────┘
```

### What Lives Where

| Component | Responsibility | Changes Required |
|-----------|---------------|-----------------|
| **EHR (Epic/Cerner)** | Launches OE3 in iframe, provides auth context | Config only — register OE3 as SMART app |
| **OE3 Frontend** | SMART launch handler, OAuth2 PKCE flow, patient context mapping, study display, viewer embedding | **New code — this is what we build** |
| **Orthanc Server** | Serves DICOM data via REST API and DICOMweb | **No changes** — receives same API calls as always |
| **FHIR Server** | Provides patient demographics (MRN lookup) | Already exists as part of EHR infrastructure |

### Dual-Mode Operation

OE3 must work in two modes:

**Standalone Mode** (default — current behavior):

- Full study browser, sidebar nav, upload, settings
- No patient scoping
- Used by PACS admins, radiologists, standalone deployments

**Embedded/EHR Mode** (SMART launch):

- Patient-scoped study list only
- No sidebar nav (iframe constraints)
- Streamlined header: patient name + MRN + "Viewing imaging for [Patient]"
- Direct study → viewer workflow
- Triggered by URL parameters: `/launch?iss=...&launch=...` or `?mode=embedded&patient=MRN`

Detection logic:

```typescript
// In React router or app initialization
const isSmartLaunch = searchParams.has('iss') && searchParams.has('launch');
const isEmbeddedMode = searchParams.get('mode') === 'embedded';
const isStandalone = !isSmartLaunch && !isEmbeddedMode;
```

---

## Implementation Details

### JavaScript Library: `fhirclient`

The official SMART on FHIR JavaScript client handles the entire OAuth2 dance:

- **npm:** `npm i fhirclient` (package: `fhirclient`, v2.6.3+)
- **CDN:** `https://cdn.jsdelivr.net/npm/fhirclient/build/fhir-client.js`
- **Docs:** <http://docs.smarthealthit.org/client-js/>
- **GitHub:** <https://github.com/smart-on-fhir/client-js>
- **License:** Apache-2.0
- **Browser + Node support**

#### Launch Page (`/launch`)

```typescript
import FHIR from "fhirclient";

// Called when EHR opens our app
FHIR.oauth2.authorize({
  clientId: "oe3_smart_app",
  scope: "launch openid fhirUser patient/*.read",
  redirectUri: "/callback"
});
```

#### Callback Page (`/callback`)

```typescript
import FHIR from "fhirclient";

FHIR.oauth2.ready().then(client => {
  // client.patient.id = FHIR Patient resource ID
  // client.user = current practitioner
  
  // Get patient demographics to extract MRN
  client.patient.read().then(patient => {
    const mrn = patient.identifier?.find(
      id => id.type?.text === "MRN" || id.type?.coding?.[0]?.code === "MR"
    )?.value;
    
    // Now query Orthanc with this MRN
    queryOrthancByPatientId(mrn);
  });
});
```

#### Multi-EHR Configuration

The `fhirclient` library supports routing to different configs based on the ISS:

```typescript
FHIR.oauth2.authorize([
  {
    issMatch: /\bepic\b/i,
    clientId: process.env.EPIC_CLIENT_ID,
    scope: "launch openid fhirUser patient/*.read",
    redirectUri: "/callback"
  },
  {
    issMatch: /\bcerner\b|oracle/i,
    clientId: process.env.CERNER_CLIENT_ID,
    scope: "launch openid fhirUser patient/*.read",
    redirectUri: "/callback"
  },
  {
    // Fallback for SMART App Launcher testing
    issMatch: /smarthealthit/,
    clientId: "oe3_test",
    scope: "launch openid fhirUser patient/*.read",
    redirectUri: "/callback"
  }
]);
```

### Patient ID Mapping: FHIR → DICOM

The critical bridge between EHR world and DICOM world:

**FHIR Patient resource → MRN → Orthanc PatientID**

```typescript
async function mapFhirPatientToOrthanc(fhirClient, orthancBaseUrl) {
  const patient = await fhirClient.patient.read();
  
  // Extract MRN from FHIR identifiers
  // Epic uses system: "urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.14"
  // The system OID varies per Epic customer
  const mrn = patient.identifier?.find(id => {
    return id.type?.text === "MRN" 
      || id.type?.coding?.some(c => c.code === "MR")
      || id.use === "usual";
  })?.value;

  if (!mrn) throw new Error("Could not extract MRN from FHIR Patient");

  // Query Orthanc for studies with this PatientID
  const response = await fetch(`${orthancBaseUrl}/tools/find`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Level: "Study",
      Query: { PatientID: mrn },
      Expand: true
    })
  });

  return response.json();
}
```

**Important caveat:** The MRN identifier system OID varies per Epic customer. In production, OE3 would need a configuration option mapping `iss` → `mrn_system_oid` to reliably extract the right MRN. For the sandbox, Epic uses `urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.14`.

### Viewer Integration

For the actual image viewing, OE3 can embed:

1. **OHIF Viewer** (<https://ohif.org/>) — React-based, DICOMweb-native, most full-featured
2. **Cornerstone.js** (<https://www.cornerstonejs.org/>) — Lower-level library, more customizable
3. **dwv** (DICOM Web Viewer) — Lighter weight option

The viewer connects to Orthanc's DICOMweb endpoint:

```text
GET /dicom-web/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances
GET /dicom-web/wado?...  (for image retrieval)
```

In embedded mode, the flow is:

1. SMART launch → get patient context → get MRN
2. Query Orthanc for patient's studies → display study list
3. User clicks study → embedded viewer loads via DICOMweb
4. All within the EHR's iframe

---

## Testing Environments

### Tier 1: SMART App Launcher (Start Here)

**URL:** <https://launch.smarthealthit.org>

**What it is:** A free, no-registration-required tool that simulates an EHR launching your SMART app. Maintained by the SMART Health IT project (Boston Children's Hospital / Harvard).

**How to use it:**

1. Go to <https://launch.smarthealthit.org>
2. Launch Type: "Provider EHR Launch" + "Simulate launch within the EHR user interface"
3. FHIR Version: R4
4. Select a test patient from the patient picker
5. Select a test provider from the provider picker
6. Enter your app's Launch URL (e.g., `http://localhost:5173/launch`)
7. Click "Launch App!"

**What it tests:**

- Full OAuth2 authorization code flow with PKCE
- Patient context delivery
- Provider context delivery
- FHIR R4 resource access
- Iframe embedding simulation

**Backed by:** HAPI FHIR Server with pre-loaded synthetic patient data (Synthea-generated). Includes patients with various conditions, medications, observations.

**Limitations:** The test patients won't have imaging data (no ImagingStudy resources), so you'll need to mock the Orthanc connection or have a local Orthanc with matching PatientIDs.

**Docker option:** You can also run it locally:

```bash
docker run -t -p 9009:80 smartonfhir/smart-launcher:latest
```

### Tier 2: SMART Dev Sandbox (Docker, Full Stack)

**GitHub:** <https://github.com/smart-on-fhir/smart-dev-sandbox>

**What it is:** A Docker-compose stack that runs the complete SMART ecosystem locally: HAPI FHIR server, auth server, patient browser, app launcher.

**Setup:**

```bash
git clone https://github.com/smart-on-fhir/smart-dev-sandbox.git
cd smart-dev-sandbox
# Edit .env to configure FHIR versions (R4 recommended)
docker compose up -d
```

**Why use it:** Full control over test data. You can insert custom Patient resources with MRNs that match your local Orthanc instance. Best for integration testing the full pipeline: EHR launch → FHIR patient → MRN → Orthanc query → viewer.

### Tier 3: Epic Sandbox

**URL:** <https://open.epic.com> / <https://fhir.epic.com>

**Registration:** Free developer account at open.epic.com

**What you get:**

- Non-production Client ID for testing
- SMART on FHIR EHR launch simulation via <https://open.epic.com/launchpad>
- Sandbox FHIR R4 endpoint with test patients
- Full OAuth2 flow identical to production Epic

**Key details:**

- Sandbox base URL: documented at fhir.epic.com
- Test patient search by MRN: `GET /api/FHIR/R4/Patient?identifier=urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.14|{MRN}`
- MyChart test credentials for patient-facing apps: username `fhirjason`, password `epicepic1`
- After registering your app, allow ~10 minutes for propagation

**Testing flow:**

1. Register app at open.epic.com → get non-production Client ID
2. Go to open.epic.com/launchpad → select "OAuth 2.0 SSO" launch type
3. Enter your Launch URL
4. Select a test patient
5. Click Launch → your app opens in simulated EHR frame

**Path to production:** Epic Showroom (formerly App Orchard) listing → security review → customer-specific onboarding per health system.

### Tier 4: Oracle Health (Cerner) Sandbox

**URL:** <https://code-console.cerner.com> (requires CernerCare account)

**What you get:**

- FHIR R4 sandbox endpoints
- App registration via code Console
- Sandbox patient data for testing
- Provider and patient launch simulation

**Documentation:** <https://docs.oracle.com/en/industries/health/millennium-platform-apis/build-smart-on-fhir-apps/>

### Tier 5: Inferno Test Suite (Compliance Validation)

**URL:** <https://inferno.healthit.gov/test-kits/smart-app-launch/>

**What it is:** Official ONC (Office of the National Coordinator) testing tool that validates your SMART implementation against the spec. Used for certification. Not for development — use after you have a working implementation.

---

## Recommended Development Sequence

### Phase 0: Local Proof of Concept (1-2 evenings)

**Goal:** Prove the SMART launch → Orthanc query pipeline works.

1. Add `/launch` and `/callback` routes to OE3 using `fhirclient` library
2. Test with SMART App Launcher (<https://launch.smarthealthit.org>)
3. On successful auth, log the patient FHIR ID and extracted MRN to console
4. Hardcode a matching PatientID in local Orthanc with a test DICOM study
5. Display the study list filtered to that patient

**Deliverable:** Screenshot of OE3 launched from SMART App Launcher showing a patient-scoped study list. This screenshot alone is LinkedIn-worthy.

### Phase 1: Embedded Mode UI (1-2 evenings)

**Goal:** OE3 renders cleanly inside an iframe.

1. Detect embedded mode from URL params or SMART launch context
2. Hide sidebar navigation, settings, upload
3. Show compact header: patient name + MRN + "Imaging Studies"
4. Study list → click → open viewer (OHIF or Cornerstone)
5. Test iframe rendering in SMART App Launcher's EHR simulation

### Phase 2: Epic Sandbox Integration (1 weekend)

**Goal:** Working launch from Epic's sandbox.

1. Register OE3 at open.epic.com
2. Configure Epic-specific client ID
3. Test launch from open.epic.com/launchpad
4. Handle Epic's MRN identifier format
5. Document the Epic-specific configuration

### Phase 3: Viewer Embedding (1 weekend)

**Goal:** Full study → series → image viewing within EHR.

1. Embed OHIF Viewer or Cornerstone.js as a component
2. Wire DICOMweb URLs to Orthanc's DICOMweb plugin
3. Handle viewer toolbar (windowing, zoom, pan, scroll)
4. Test image loading performance within iframe

### Phase 4: Documentation & Demo (ongoing)

**Goal:** Publishable proof of capability.

1. README section: "EHR Integration via SMART on FHIR"
2. Architecture diagram
3. Video demo: Epic sandbox → OE3 launch → study viewing
4. Configuration guide per EHR vendor
5. Docker compose example with Orthanc + OE3 + SMART launcher for local testing

---

## Configuration Design

OE3 needs a SMART configuration section, either in a config file or environment variables:

```json
{
  "smart": {
    "enabled": true,
    "clients": {
      "epic": {
        "clientId": "oe3-epic-client-id",
        "scope": "launch openid fhirUser patient/*.read",
        "issPattern": "epic\\.com"
      },
      "cerner": {
        "clientId": "oe3-cerner-client-id",
        "scope": "launch openid fhirUser patient/*.read",
        "issPattern": "cerner\\.com|oracle"
      },
      "default": {
        "clientId": "oe3-default",
        "scope": "launch openid fhirUser patient/*.read"
      }
    },
    "patientIdMapping": {
      "strategy": "mrn_from_fhir_identifier",
      "mrnIdentifierSystems": [
        "urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.14"
      ],
      "fallbackToFhirId": false
    },
    "embeddedMode": {
      "hideNavigation": true,
      "hideUpload": true,
      "hideSettings": true,
      "showPatientBanner": true
    }
  }
}
```

---

## Security Considerations

- **PKCE required:** All browser-based OAuth2 flows must use PKCE (Proof Key for Code Exchange). The `fhirclient` library handles this automatically.
- **No client secrets in browser:** OE3 is a public client. Never embed client secrets in frontend code.
- **Token storage:** Access tokens stored in sessionStorage (default for `fhirclient`). Cleared on tab close.
- **CORS:** Orthanc must allow CORS from the EHR's domain if the iframe makes direct requests. Alternatively, route through a proxy.
- **iframe restrictions:** Some EHRs set `X-Frame-Options` or CSP headers. OE3 must work within these constraints.
- **HIPAA:** Patient data flows through standard SMART scopes. OE3 doesn't store patient data — it displays it in real-time from Orthanc.

---

## Competitive Landscape

No other Orthanc frontend offers SMART on FHIR integration:

| Frontend | SMART on FHIR | EHR Embeddable |
|----------|:------------:|:--------------:|
| OE1 (built-in) | ❌ | ❌ |
| OE2 (Stone of Orthanc) | ❌ | ❌ |
| Orthanc Tools JS (archived) | ❌ | ❌ |
| **OE3 (ours)** | **✅ (planned)** | **✅ (planned)** |

Commercial PACS vendors (Visage, Sectra, Horos) have their own EHR integrations but are expensive and proprietary. An open-source Orthanc viewer with SMART launch support would be unique.

---

## References

- SMART on FHIR spec: <https://docs.smarthealthit.org/>
- SMART App Launch IG: <https://hl7.org/fhir/smart-app-launch/>
- fhirclient JS library: <https://github.com/smart-on-fhir/client-js>
- SMART App Launcher (testing): <https://launch.smarthealthit.org>
- SMART Dev Sandbox (Docker): <https://github.com/smart-on-fhir/smart-dev-sandbox>
- Epic on FHIR: <https://fhir.epic.com>
- Epic Launchpad: <https://open.epic.com/launchpad>
- Oracle Health SMART docs: <https://docs.oracle.com/en/industries/health/millennium-platform-apis/build-smart-on-fhir-apps/>
- Inferno Test Suite: <https://inferno.healthit.gov/test-kits/smart-app-launch/>
- Synthea (synthetic FHIR data): <https://github.com/synthetichealth/synthea>

---

## Competitive Context Update

### Epic's Imaging Architecture

Epic does NOT ship its own PACS or diagnostic image viewer. Their imaging stack is:

- **Epic Radiant** — Radiology Information System (RIS). Handles orders, scheduling, result documentation, film tracking. Workflow management, not image viewing.
- **Image links in patient charts** — When a clinician clicks an imaging link, it launches an *external* third-party viewer (Fujifilm Synapse, Sectra, GE, Philips, Hyland, Intelerad, etc.)
- **Epic provides integration APIs** — SSO, patient context sync, study context sync, WADO retrieval. But the actual viewer is always third-party.

**Market structure:** Epic manages workflow → Commercial PACS stores/serves images → Commercial viewer displays them. These commercial viewers cost $200K+ in licensing and integrate through proprietary APIs and occasionally SMART on FHIR.

**OE3 opportunity:** Community hospitals, imaging centers, clinics, research institutions, and international facilities that can't afford commercial PACS viewer licenses. Orthanc + OE3 with SMART launch = open-source stack that plugs into their EHR the same way the big vendors do.

### Jodogne's FHIR Work (Related but Different)

Sébastien Jodogne published two papers on Orthanc + FHIR:

- "Setting a PACS on FHIR" — HEALTHINF 2024 (BIOSTEC), SCITEPRESS, pp. 123-131
- "Combining Languages to Set a PACS on FHIR" — Springer 2026, expanded version

His approach: Using Java and Python plugins to make Orthanc **serve** FHIR resources (ImagingStudy) via HAPI FHIR framework. This turns Orthanc into a FHIR-compliant imaging data source.

**Our approach is different and complementary:** We're not making Orthanc serve FHIR. We're making OE3 **consumable** by EHRs via SMART launch. These solve different problems:

- Jodogne: "How do FHIR clients query Orthanc for imaging metadata?" (server-side)
- OE3 SMART: "How do clinicians view Orthanc images without leaving their EHR?" (client-side)

Both could coexist. In fact, Jodogne's FHIR ImagingStudy support could make the patient-to-study mapping even cleaner — OE3 could query the FHIR ImagingStudy endpoint directly instead of mapping MRN → DICOM PatientID.

**Nobody has done the SMART launch integration for Orthanc.** This is confirmed — no plugins, no frontends, no community projects address embedding an Orthanc viewer inside an EHR.

---

## Research Paper Opportunity

### Why This Is Publishable

This work sits at the intersection of three active research areas:

1. Open-source medical imaging infrastructure (Orthanc ecosystem)
2. FHIR-based EHR interoperability (SMART on FHIR standard)
3. Clinical workflow integration (embedding PACS in EHR)

The novel contribution: **First open-source DICOM viewer with SMART on FHIR EHR launch capability**, enabling Orthanc deployments to be embedded directly inside Epic, Oracle Health, and other SMART-enabled EHRs. This bridges the gap between Orthanc's server-side FHIR capabilities (Jodogne 2024, 2026) and the clinical workflow where images are actually consumed.

### Target Venues (Ranked by Fit)

#### 1. SIIM Annual Meeting + JIIM Journal (Best Fit)

- **Conference:** SIIM26, June 10-12, 2026, Pittsburgh, PA
- **Hackathon:** June 10-12, 2026 — hybrid (in-person + virtual). OE3 + SMART launch would be a strong hackathon project.
- **Abstract deadline:** December 15 (for 2026, likely past — check for late submissions or target SIIM27)
- **Journal:** Journal of Imaging Informatics in Medicine (JIIM), peer-reviewed, indexed in PubMed/Index Medicus. Accepts experience reports and technical notes.
- **Why best fit:** SIIM's audience IS PACS administrators, imaging informaticists, and healthcare IT leaders. They care about exactly this: open-source DICOM + EHR integration. Published abstracts appear as JIIM supplements.
- **Hackathon angle:** Enter the SIIM26 hackathon with OE3. Build the SMART launch demo live. Hackathon projects get showcased and can lead to papers.

#### 2. HEALTHINF / BIOSTEC (Jodogne's Venue)

- **Conference:** BIOSTEC 2027 (next available — BIOSTEC 2026 deadline was Dec 16, 2025, already passed)
- **Why good:** Direct continuation of Jodogne's work. Can cite his papers and present OE3 SMART as the client-side complement. Paper would be reviewed by people already familiar with Orthanc.
- **Format:** Regular paper (8-10 pages) or Position Paper (4-6 pages, work in progress OK)
- **Published by:** SCITEPRESS, later expanded versions invited to Springer CCIS

#### 3. Journal of Digital Imaging / JIIM (Direct Journal Submission)

- **Journal:** JIIM (Springer Nature), successor to JDI
- **No conference required** — submit anytime
- **Accepts:** Technical notes, experience reports, hypothesis-driven research
- **Indexed:** PubMed, Index Medicus
- **Audience:** Imaging informatics professionals, radiologists, PACS administrators

#### 4. AMIA (American Medical Informatics Association)

- **Conference:** AMIA Annual Symposium (usually November)
- **Broader audience** — health informatics generally, not imaging-specific
- **Good if framing emphasizes interoperability and 21st Century Cures Act compliance**

#### 5. IHE Connectathon / HIMSS

- **Not traditional paper venues** but good for demos and industry visibility
- **IHE Connectathon** tests interoperability profiles — demonstrating SMART launch with Orthanc would be noteworthy

### Suggested Paper Structure

**Title:** "Embedding an Open-Source PACS Viewer in EHR Workflows via SMART on FHIR: Orthanc Explorer 3"

**Abstract:** Present OE3 as the first open-source DICOM viewer with SMART on FHIR EHR launch capability. Demonstrate successful integration with Epic sandbox and SMART App Launcher. Discuss architecture (pure SPA, no backend, zero Orthanc modifications), patient context mapping (FHIR Patient → MRN → DICOM PatientID), and implications for resource-constrained healthcare facilities.

**Sections:**

1. Introduction — Gap between Orthanc's capabilities and clinical workflow integration
2. Background — Orthanc ecosystem, SMART on FHIR standard, Jodogne's FHIR work
3. Architecture — OE3 design, SMART launch flow, dual-mode operation
4. Implementation — fhirclient library, patient mapping, viewer embedding
5. Evaluation — Testing against SMART App Launcher, Epic sandbox, Oracle Health sandbox
6. Discussion — Deployment considerations, security, limitations, future work
7. Conclusion — First open-source SMART-on-FHIR PACS viewer, lowering barrier for EHR-integrated imaging

**Co-author consideration:** Could invite Jodogne as co-author or reviewer — his server-side FHIR work + your client-side SMART work = complete story. Even a citation + acknowledgment builds the relationship.

### Timeline for Research Track

- **Now → March 2026:** Build OE3 SMART launch (Phases 0-2)
- **March 2026:** Test against Epic sandbox, capture screenshots/metrics
- **April 2026:** Write paper draft
- **May 2026:** Submit to JIIM or prep SIIM26 hackathon entry
- **June 2026:** SIIM26 hackathon showcase (if pursuing that track)
- **September 2026:** Submit to HEALTHINF/BIOSTEC 2027 (typical December deadline)

### Hopkins Affiliation

Your JHU graduate degree could be relevant for academic credibility. Check if you can still list Hopkins affiliation (alumni status) or collaborate with someone at JHU's imaging informatics group.

---

## Combined Paper Framing: End-to-End Open-Source Cloud Imaging

### The Full Architecture Story

The OAuth plugin and SMART on FHIR launch are not isolated projects — they form a complete, secure, open-source imaging pipeline that connects EHR clinician workflows to cloud PACS infrastructure through Orthanc.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLINICIAN WORKFLOW                               │
│                                                                         │
│  ┌──────────┐    SMART on FHIR     ┌──────────────┐                   │
│  │  Epic /   │ ──── launch ───────→ │  Orthanc     │                   │
│  │  Cerner   │    (OAuth2 PKCE)     │  Explorer 3  │                   │
│  │  EHR      │ ←── patient ctx ──── │  (React SPA) │                   │
│  └──────────┘                       └──────┬───────┘                   │
│                                            │                            │
│                                     Orthanc REST API                    │
│                                     + DICOMweb                          │
│                                            │                            │
├────────────────────────────────────────────┼────────────────────────────┤
│                        ORTHANC CORE                                     │
│                                            │                            │
│                                    ┌───────┴────────┐                  │
│                                    │    Orthanc      │                  │
│                                    │    Server       │                  │
│                                    │  (DICOM store)  │                  │
│                                    └───────┬────────┘                  │
│                                            │                            │
│                                 orthanc-dicomweb-oauth                  │
│                                    (Python plugin)                      │
│                                            │                            │
├────────────────────────────────────────────┼────────────────────────────┤
│                     CLOUD PACS BACKENDS                                 │
│                                            │                            │
│              ┌─────────────────────────────┼──────────────────┐        │
│              │                             │                  │        │
│    ┌─────────▼──────────┐   ┌──────────────▼───┐  ┌─────────▼──────┐ │
│    │  Azure Health Data  │   │  Google Cloud     │  │  Any OIDC      │ │
│    │  Services DICOM     │   │  Healthcare API   │  │  Provider      │ │
│    │                     │   │                   │  │                │ │
│    │  🔐 Managed Identity│   │  🔐 OAuth2 Client │  │  🔐 OAuth2     │ │
│    │  (zero credentials) │   │  Credentials      │  │  Client Creds  │ │
│    │                     │   │                   │  │                │ │
│    │  • No secrets in    │   │  • Service account │  │  • Keycloak   │ │
│    │    config           │   │    key file        │  │  • Auth0      │ │
│    │  • Azure auto-      │   │  • Workload        │  │  • Okta       │ │
│    │    rotates tokens   │   │    Identity         │  │  • AWS IAM   │ │
│    │  • Works in ACA,    │   │    Federation       │  │  • Custom    │ │
│    │    AKS, Azure VMs   │   │    (no keys)        │  │              │ │
│    └────────────────────┘   └───────────────────┘  └────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Narrative

This architecture is notably secure because credentials never touch the application layer:

**Azure (Tier 2 — Managed Identity):**

- Zero credentials stored anywhere — no client secrets, no certificates, no config files
- Azure's identity platform automatically provisions and rotates tokens
- The Orthanc container running in Azure Container Apps or AKS receives tokens from the Azure Instance Metadata Service (IMDS) at `169.254.169.254`
- Token acquisition is invisible to the plugin — `azure-identity`'s `DefaultAzureCredential` handles everything
- Even if the container is compromised, there are no credentials to exfiltrate
- Scoped to specific resources via Azure RBAC — the managed identity only has access to the DICOM service it needs

**Google Cloud (Tier 1 — OAuth2 + Workload Identity):**

- Service account key file (traditional) OR Workload Identity Federation (keyless)
- Workload Identity Federation: GKE pods authenticate directly, no key files
- OAuth2 client credentials flow with automatic token refresh
- Scoped via Google Cloud IAM roles

**Generic OIDC (Tier 1 — Client Credentials):**

- Standard OAuth2 client credentials flow
- Works with any OIDC-compliant provider: Keycloak, Auth0, Okta, AWS Cognito
- Client ID + secret stored in Orthanc config or environment variables
- Tokens cached in memory, refreshed before expiry
- Supports token introspection for validation

**The security chain:**

1. **Clinician → EHR:** Authenticated by hospital SSO (Active Directory, etc.)
2. **EHR → OE3:** SMART on FHIR OAuth2 with PKCE (no client secrets in browser)
3. **OE3 → Orthanc:** Basic auth or token passthrough (internal network / localhost)
4. **Orthanc → Cloud PACS:** OAuth2 bearer tokens, managed identity where available (zero stored credentials)

Every hop is authenticated. The most sensitive leg (Orthanc → Cloud PACS) uses the strongest mechanism available for each provider, with managed identity being the gold standard on Azure — literally no credentials exist that could be leaked, rotated late, or stolen.

### Combined Paper Concept

**Title:** "Secure Open-Source Cloud Imaging: Bridging EHR Workflows and Cloud PACS Through Orthanc with SMART on FHIR and OAuth2"

**Or shorter:** "From EHR to Cloud PACS: An Open-Source Pipeline Using SMART on FHIR and OAuth2 with Orthanc"

**Abstract (draft):**

Open-source DICOM servers such as Orthanc are widely deployed in research and clinical settings, yet two critical integration gaps remain: secure federation with cloud-hosted PACS services (Azure Health Data Services, Google Cloud Healthcare API) and embedding imaging workflows within EHR systems (Epic, Oracle Health). We present two complementary contributions that together form a complete, secure, open-source imaging pipeline. First, orthanc-dicomweb-oauth, a Python plugin enabling Orthanc to authenticate against any OAuth2/OIDC-compliant DICOMweb endpoint, with support for Azure Managed Identity (zero-credential authentication), Google Cloud service accounts, and generic OIDC providers. Second, Orthanc Explorer 3, a modern React-based frontend with SMART on FHIR EHR launch capability, allowing clinicians to view Orthanc-managed imaging directly within their EHR. The combined architecture provides an end-to-end solution where clinician authentication flows from the EHR through SMART on FHIR to the viewer, while backend authentication flows from Orthanc through OAuth2 to cloud PACS — with no stored credentials on the Azure path. We evaluate the system against the SMART App Launcher, Epic sandbox, and Azure Health Data Services, demonstrating successful patient-context-aware image viewing with sub-second token acquisition. The complete system is released as open-source software under the MIT license.

**Key contributions (for reviewers):**

1. First generic OAuth2 plugin for Orthanc outbound DICOMweb connections (provider-agnostic)
2. First open-source DICOM viewer with SMART on FHIR EHR launch capability
3. Zero-credential cloud PACS authentication via Azure Managed Identity
4. Complete open-source pipeline from EHR launch to cloud image retrieval
5. All components released under MIT license with Docker deployment examples

**Why this paper is stronger combined:**

- Each piece alone is a useful tool. Together they tell a complete deployment story.
- The security narrative only works when you show the full chain: every hop authenticated, credentials eliminated where possible.
- Reviewers can envision a real deployment: community hospital runs Orthanc + OE3, federates with regional cloud PACS, clinicians access it from Epic — all open source, all secure.
- Directly extends Jodogne's "Setting a PACS on FHIR" (2024) by adding both the outbound auth story and the inbound EHR embedding story.

---

## Updated Viewer Strategy for Embedded EHR Mode

### Recommendation: Cornerstone3D Embedded, OHIF as Escape Hatch

The OE2 pattern of launching OHIF in a new browser tab **does not work** in embedded EHR mode:

- Already inside an iframe (EHR launched OE3 via SMART)
- New tabs break EHR workflow, lose patient context visually
- Some EHR iframe configurations block `window.open()` via CSP headers
- Clinicians expect inline viewing, not context switching

### Architecture

```text
EHR iframe
  └── OE3 (React SPA)
       ├── Compact header (patient name, MRN, back arrow)
       ├── Study list (filtered via SMART patient token)
       └── When user clicks a study:
            └── Viewer panel (Cornerstone3D viewport)
                 ├── Series thumbnails (left rail or top strip)
                 ├── Main viewport (scroll, W/L, zoom, pan)
                 ├── Basic tools (measurement, annotation)
                 └── "Open in Full Viewer" link → OHIF in new tab
```

### Why Cornerstone3D, Not Embedded OHIF

Cornerstone3D is the rendering engine *underneath* OHIF. OHIF is a complete application framework (routing, state management, study list, hanging protocols, configuration). Embedding one SPA inside another SPA inside an EHR iframe creates:

- Routing conflicts (both apps want to own the URL)
- State management collisions
- CSS conflicts
- Over-engineering for the use case

Cornerstone3D as a library avoids all of this — import it, create a viewport element, feed it DICOMweb image IDs, it renders. Same image quality as OHIF because it's literally the same renderer.

### Clinical Context

In embedded EHR mode, users are:

- Referring physicians checking if imaging was completed
- ER docs glancing at the chest X-ray
- Surgeons reviewing pre-op imaging
- Primary care reviewing follow-up scans

They are **NOT** doing primary diagnostic reads. They need fast, simple viewing — not hanging protocols and multi-monitor layouts. Cornerstone3D handles this perfectly.

For the rare case needing full diagnostic tooling → "Open in Full Viewer" escape hatch launches OHIF (or the institution's FDA-cleared viewer) in a new tab with the study pre-selected via DICOMweb URL parameters.

### Implementation Notes

**Libraries:**

```text
@cornerstonejs/core
@cornerstonejs/streaming-image-volume-loader
@cornerstonejs/tools
```

All TypeScript, MIT licensed, React examples in docs. A minimal `<ViewportPanel>` component is ~200-300 lines: takes study/series identifier, fetches instance list from Orthanc DICOMweb, hands image IDs to Cornerstone for rendering.

**DICOMweb connection:** Cornerstone3D supports WADO-RS natively — connects directly to Orthanc's `/dicom-web/` endpoints.

### FDA Regulatory Boundary

This architecture creates a clean regulatory separation:

- OE3 + embedded Cornerstone3D in informational/review mode = **not a diagnostic workstation**
- "Open in Full Viewer" explicitly delegates diagnostic viewing to whatever the institution has cleared
- Disclaimer: "Not intended for primary diagnostic interpretation"
- Paper can describe the architecture without regulatory complications

See: [[Orthanc-Explorer-3#FDA Regulatory Positioning]] for full regulatory analysis.

### Dual-Mode Summary

| Feature | Standalone Mode | Embedded EHR Mode |
|---------|----------------|-------------------|
| Study browsing | Full (all patients) | Patient-scoped (SMART token) |
| Sidebar nav | Visible | Hidden |
| Settings/Upload | Available | Hidden |
| Image viewing | OHIF in new tab (default) | Cornerstone3D inline |
| Full viewer access | Direct (configured viewer URL) | "Open in Full Viewer" escape hatch |
| Patient banner | Optional | Always shown |

### Existing Viewer Component — Adaptation Path

Rob's ResonAit codebase already contains a fully functional `MultiSeriesViewer` React component (~750 lines) with 4-panel grid layout, synchronized scrolling, W/L/pan/zoom tools, cine playback, drag-and-drop, touch support, and progressive image loading. See [[Orthanc-Explorer-3#Existing Viewer Framework — MultiSeriesViewer Component]] for full analysis.

**For OE3 embedded EHR mode:** Fork the component, swap the rendering backend from pre-rendered PNGs to Cornerstone3D (for proper DICOM pixel data from Orthanc's WADO-RS), and default to single-panel maximized layout with auto-loading from the SMART-scoped patient's studies. The entire UI framework (toolbar, sync, layout, interactions) is reusable as-is.

This significantly reduces Phase 3 (Viewer Embedding) from "1 weekend" to "a few evenings" — the hardest part is already built.
