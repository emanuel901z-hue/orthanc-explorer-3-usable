# OE3 — Schweizer Taschenmesser Roadmap & Sprint-Plan

> **Datum:** 2026-09-25  
> **Ziel:** Orthanc Explorer 3 (OE3) von einer reinen Anzeige-Oberfläche zu einem robusten, vollwertigen „Schweizer Taschenmesser“ für Orthanc DICOM-Server auszubauen.

---

## 1. Ausgangslage & Bestandsaufnahme

OE3 bietet eine moderne, responsive Oberfläche mit Zustandsspeicherung, Mehrsprachigkeit (9 Sprachen inklusive Arabisch RTL) und MWL-Broker-Integration. Beim detaillierten Code-Audit gegen die reale Orthanc-REST-API und im Vergleich zum Funktionsumfang von Orthanc Explorer 2 (OE2) wurden jedoch kritische Lücken und Fehlerbilder identifiziert:

1. **Merge & Modify Sollbruchstellen:**
   - Unbeachteter `FailedInstancesCount`: Orthanc antwortet bei Merge-Problemen mit HTTP 200; Teilausfälle wurden in der UI als voller Erfolg angezeigt.
   - Audit-Bypass: `MigrateSeriesDialog` und `MigrateInstanceDialog` riefen direkt `studiesApi.merge` auf, ohne `AuditEvent` auszulösen.
   - Fehlender Patient-Mismatch-Schutz: Beliebige Studien/Serien fremder Patienten konnten versehentlich ineinander gemergt werden.
   - 404-Falle bei `Modify`: Nach `KeepSource: false` löscht Orthanc die alte ID. Die UI verharrte auf der gelöschten URL, statt auf die neue ID zu navigieren.
   - Serieller Loop statt nativer Batch-Merge in `MigrateStudyDialog`.
2. **Remote Sources / Query-Retrieve Lücke:**
   - C-FIND / C-MOVE in `RemoteSourcesPage` lief über Phantasie-Endpunkte (`/modalities/:name/query/:id/retrieve` existiert nicht in Orthanc).
   - Echte Abfrage und Import entfernter Studien über `/queries` fehlte.
3. **Fehlende Dokumenten-Vorschau:**
   - Encapsulated PDFs und DICOM Structured Reports (SR) mussten als Binärdatei heruntergeladen werden.
4. **Fehlende erweiterte Werkzeuge:**
   - Keine Anonymisierungs-Profile (nur manuelle Einzelfelder).
   - Kein schneller DICOM-UID-Lookup (`/tools/lookup`).
   - Keine Peer-to-Peer Transfer-UI.

---

## 2. Sprint-Übersicht

| Sprint | Thema | Kerninhalte | Tests |
|---|---|---|---|
| **Sprint 1** | **Merge- & Modify-Integrität** | `FailedInstancesCount`-Auswertung, Patient-Mismatch-Schutz, Audit-Seam für Serien/Instanzen, 404-Fix nach Modify, atomarer Batch-Merge | Unit-Tests für Actions + Dialog-Tests |
| **Sprint 2** | **DICOM Query & Retrieve (C-FIND / C-MOVE)** | `queries.ts` API-Client (`/queries/{id}`), `queryModalityAction`, `retrieveModalityAction`, voll funktionale Q/R-Tabelle mit Import-Status | API- & Flow-Tests |
| **Sprint 3** | **In-Browser PDF & Structured Report (SR) Viewer** | SOPClass-Erkennung, native Inline-PDF-Vorschau (`/instances/:id/pdf` bzw. Blob), strukturierte SR-Textdarstellung | Renderer-Tests |
| **Sprint 4** | **Anonymisierungs-Profile & UID Lookup Tool** | DICOM PS 3.15 Presets in `AnonymizeDialog`, globales UID-Lookup-Modal via `/tools/lookup` | Preset- & Lookup-Tests |
| **Sprint 5** | **Peer-to-Peer Transfer (Orthanc Peers)** | `SendToPeerDialog` auf Studien- und Serienebene, `sendToPeerAction` mit Audit | Peer-Send-Tests |
| **Sprint 6** | **Serien- & Instanz-basiertes Split & Merge (Cut & Paste Suite)** | `POST /studies/:id/split` angebunden, `SplitStudyDialog`, Serien-Bulk-Split in `StudyDetailPage`, Instanz-Multiselect & Merge/Split in `SeriesDetailPage`, `MigrateInstanceDialog` fuer Bulk erweitert | Unit-Tests + Multimodale DOM- & Screenshot-Analyse |

---

## 3. Detaillierte Sprint-Definitionen

### Sprint 1: Merge- & Modify-Integrität (Bugs & Safety)
- **1.1 `FailedInstancesCount` in `mergeStudyAction`:**
  - `studiesApi.merge` Typisierung erweitern: `{ TargetStudy: string; InstancesCount: number; FailedInstancesCount: number; Description: string }`.
  - Bei `FailedInstancesCount > 0`: `mergeStudyAction` gibt die genaue Fehleranzahl zurück; die Dialoge melden Teil-Erfolge bzw. Warnungen statt stummem Datenverlust.
- **1.2 Cross-Patient Mismatch Guard:**
  - Migration prüfen: `patientSignaturesMatch(targetPatient, candidatePatient)`.
  - Im Dialog farbliche Kennzeichnung (grün = gleicher Patient, gelb/rot = abweichender Patient).
  - Sicherheitsabfrage vor Ausführung, wenn der Patient abweicht.
- **1.3 Audit-Seam Schließung:**
  - `migrateSeriesAction` und `migrateInstanceAction` in `src/actions/` erstellen (mit `study.merge` / `series.merge` / `instance.merge` AuditEvents).
  - Dialoge auf diese Actions umstellen.
- **1.4 Atomarer Batch-Merge:**
  - `MigrateStudyDialog`: Alle selektierten IDs in einem einzigen `mergeStudyAction(targetId, sourceIds, keepSource)` aufrufen.
- **1.5 404-Fix nach `Modify`:**
  - `ModifyStudyDialog`, `ModifySeriesDialog`, `ModifyInstanceDialog` erhalten Rückgabewert `{ ID: string; Path: string }`.
  - Bei `KeepSource: false` wird automatisch auf die neue ID weitergeleitet.

### Sprint 2: DICOM Query & Retrieve (C-FIND / C-MOVE)
- **2.1 `src/api/queries.ts`:**
  - `POST /modalities/:name/query` -> liefert `{ ID, Path }`.
  - `GET /queries/:id/answers` -> liefert `number[]`.
  - `GET /queries/:id/answers/:index/content?simplify` -> liefert DICOM-Tags.
  - `POST /queries/:id/answers/:index/retrieve` -> stößt C-MOVE an.
  - `DELETE /queries/:id` -> räumt die temporäre Abfrage auf.
- **2.2 Actions:**
  - `queryModalityAction(modality, level, query)` mit Audit `modality.query`.
  - `retrieveQueryAnswerAction(queryId, index, targetAet)` mit Audit `modality.retrieve`.
- **2.3 `RemoteSourcesPage` Überarbeitung:**
  - Reale Abfrage-Pipeline, Fortschrittsanzeige, Ergebnistabelle mit Status (Bereit, Wird geladen, Importiert, Fehler).

### Sprint 3: In-Browser PDF & Structured Report (SR) Viewer
- **3.1 SOPClass-Erkennung:**
  - `1.2.840.10008.5.1.4.1.1.104.1` (Encapsulated PDF)
  - `1.2.840.10008.5.1.4.1.1.88.*` (Structured Reports)
- **3.2 PDF-Renderer:**
  - Tab in `InstanceDetailPage` / Vorschau in `SeriesDetailPage` via `GET /instances/:id/pdf` als `blob:application/pdf` in `<iframe>` oder `<object>`.
- **3.3 SR-Viewer:**
  - Strukturierte Baum- und Textanzeige von Container-, Text- und Code-Elementen.

### Sprint 4: Anonymisierungs-Profile & UID Lookup Tool
- **4.1 Presets in `AnonymizeDialog`:**
  - `Full`: UIDs neu, PatientName/ID anonymisiert, Datum entfernt.
  - `Clinical`: Patientendaten maskiert, UIDs und Serienstruktur erhalten.
  - `De-Identify`: Freie Eingabe mit Schnellauswahl.
- **4.2 Globales UID Lookup:**
  - Tastenkürzel oder Suchbutton für SOPInstanceUID / StudyInstanceUID.
  - Auflösung via `toolsApi.lookup()` und Navigation zur passenden Route.

### Sprint 5: Peer-to-Peer Transfer (Orthanc Peers)
- **5.1 Action & Dialog:**
  - `sendToPeerAction` via `peersApi.send()`.
  - `SendToPeerDialog` auf Studien- und Serienebene.
- **5.2 Integration:**
  - Menüpunkt in Aktionsleisten (Einzel- und Mehrfachauswahl).

### Sprint 6: Serien- & Instanz-basiertes Split & Merge (Cut & Paste Suite)
- **6.1 API & Actions:**
  - `studiesApi.split`: `POST /studies/:id/split` angebunden mit `OrthancSplitParams` und `OrthancSplitResult`.
  - `splitStudyAction`: Audit-Seam `study.split` mit Detail (neue Study-ID, SIUID, Instanzen-Zähler).
- **6.2 SplitStudyDialog:**
  - Dialog zum Ausgliedern ausgewählter Serien/Instanzen in eine neue Studie mit neuer StudyInstanceUID.
  - Serien-Checkboxen, Eingabe neuer Studienbeschreibung, Toggle `KeepSource` (Kopieren vs. Ausschneiden).
  - Sofortige Navigation zur neu erstellten Studie nach erfolgreichem Split.
- **6.3 StudyDetailPage (Serien-Ebene):**
  - Neuer Button „Aufteilen“ (`Scissors`) in der Haupt-Aktionsleiste.
  - Neuer Bulk-Aktionsbutton „Studie aufteilen (N)“ in der Serien-Tabelle.
- **6.4 SeriesDetailPage (Instanzen-Ebene):**
  - Checkboxen und Multiselect für Instanzen in der Tabelle und im Raster.
  - Bulk-Aktionsleiste:
    - „In Studie verschieben“ (Merge via erweitertem `MigrateInstanceDialog`).
    - „In neue Studie abspalten“ (Split via `splitStudyAction`).
    - „Download ZIP“ und „Löschen“.
- **6.5 Verifikation:**
  - Unit-Tests für `splitStudyAction` und `SplitStudyDialog`.
  - 100% Übersetzungsabdeckung in allen 9 Sprachen.
  - Multimodale DOM- & Screenshot-Analyse im realen Browser (Chrome).

---

## 4. Test- & Sicherheits-Konventionen

1. **Produktivschutz:**
   - Der lokale Produktiv-Orthanc (`127.0.0.1:8042`) enthält echte Patientendaten. Schreib- und Testoperationen dürfen **niemals** gegen diesen Server laufen.
   - Lokale Tests nutzen das isolierte Test-Orthanc (`127.0.0.1:3092`) bzw. Unit-Mocks.
2. **Qualitätsgates pro Sprint:**
   - `npx tsc --noEmit -p tsconfig.app.json` (0 Fehler)
   - `npx vitest run` (alle Tests grün)
   - `npm run i18n:check` (100% Chrome/Coverage)
   - `npm run lint` (0 Fehler)
   - `npm run build` (0 Fehler)
3. **Synchronisation:**
   - Saubere atomare Commits im lokalen Monorepo.
   - Synchronisation in das öffentliche Repo `emanuel901z-hue/orthanc-explorer-3-usable` über das gehärtete `push-oe3-fork.sh`.
