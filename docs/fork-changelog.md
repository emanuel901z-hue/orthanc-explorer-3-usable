# Fork Changelog

Changes in this fork (`emanuel901z-hue/orthanc-explorer-3-usable`) vs upstream (`rhavekost/orthanc-explorer-3`).

---

## v2.6.15 — Fehlerhafte Badges brechen um, TLS-Befunde verlinken (2026-10-04)

**Aus der MFA/MTA-Verifikation.** Wiederholter multimodaler Audit (Chromium-
Screenshots + DOM-Messungen) bei Desktop 1400×900, Laptop 1024×768 und Mobil
375×812 gegen den isolierten Stack.

- **Quellentabelle lief bei 1024 px über (+52 px), sobald eine Quelle einen
  offenen Circuit Breaker oder C-ECHO-Fehler zeigte** — die Spalte *Actions*
  war abgeschnitten, also genau im Problemfall. `whitespace-nowrap` an
  `BreakerBadge`/`EchoBadge` ließ den Fehlertext („association rejected",
  „breaker open · retry in 0s") die Zeile nicht umbrechen. Die Badges brechen
  jetzt um (Icon und Knopf `shrink-0`); gemessen 1024 px: **718/718** statt
  770/718.
- **TLS-Health-Befunde waren eine Sackgasse**: sie tragen keine Entity und
  hatten deshalb keinen „Fix"-Knopf. `HealthPanel.BY_CODE` führt die TLS-Codes
  jetzt auf `/broker/settings` (Zertifikatsverwaltung) — mit Test.
- Prüfumgebung entfehlalarmt: `verify-ui.cjs` hielt Dateipfade aus
  Health-Befunden für i18n-Rohschlüssel und langen `<input>`-Text für
  Layout-Overflow; der „abgelehnte Wert"-Check verglich mit einem hartkodierten
  Default; das Breaker-Szenario in `broker-config.spec.ts` brach an mehreren
  gleichzeitig offenen Breakern (strict mode).

Gates grün: `tsc` 0, `npm run lint` 0 Fehler, `npm run i18n:check` vollständig,
`npm run build` 0, **808 Tests**.

---

## v2.6.14 — Der Rollback-Knopf nur, wo er greift (2026-10-01)

**Aus dem API-Audit.** Das Änderungsprotokoll bot „Zurücksetzen" für **jede**
Zeile an — auch für die Entities, die der Broker mit 422 ablehnt
(„entity 'patient_merge' cannot be rolled back"). Neun der siebzehn Entities
haben keinen Snapshot: cache, hl7_field_map, hl7_message, merge_rule, mpps_step,
patient_merge, prefetch, spool, tls.

- `AuditEntryOut.rollbackable` sagt jetzt, ob ein Eintrag zurücknehmbar ist
  (`ConfigAudit.rollbackable` prüft gegen `audit.SERIALIZERS`), und die Seite
  zeigt den Knopf nur dann. Live: 50 Zeilen, 33 Knöpfe.
- Zwei Aktionscodes waren im Protokoll noch roh (`patient.merge`,
  `patient.link`) — die Erweiterung im Label-Test kannte nur die ADT-Formen
  (`patient.merged`). Labels ergänzt, Test erweitert; live sind **0** rohe Codes
  übrig.
- `SpoolStatus` im Client kannte `claimed` nicht (der Wert steht in der Tabelle,
  während gesendet wird).

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **807 Tests**.

---

## v2.6.13 — Eine Stelle für Fehlertexte, auch im Broker (2026-10-01)

**Der Broker hatte seinen eigenen Helfer.** `errorMessage(error)` gab einfach
`error.message` zurück — an 13 Stellen, ohne Übersetzung und ohne
Correlation-Kennung. Dabei wirft `brokerFetch` **denselben** `OrthancError` wie der
Orthanc-Client; es gab also nie einen Grund für zwei Wege.

- `errorMessage` ist weg. Die 13 Stellen (Broker-Einstellungen, Voraufnahmen,
  TLS-, ATNA- und Alerting-Karte, die Schreib-Hooks) nutzen `describeError(x, t)`
  — und zeigen damit erstmals die **Correlation-Kennung**, die der Support zum
  Auffinden der Log-Zeile braucht.
- Zwei hartkodierte englische Texte im Broker-Client sind mit übersetzt:
  `'MWL broker is not configured.'` → `errors.brokerNotConfigured`,
  `'Network error. Please try again.'` → `errors.network`.
- Der Key-Wächter prüft jetzt **auch den `errors`-Abschnitt** (kein toter
  Fehlertext, keine fehlende Übersetzung) — inklusive der Literale
  (`errors.http400` …) und der dynamischen Form.

Live geprüft mit einem abgebrochenen Broker-Aufruf:

```
Keine Verbindung zum Server. Bitte erneut versuchen. (Ref: 9ba9f6d2-…)
```

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **807 Tests**.

---

## v2.6.12 — Fehlermeldungen aus den Aktionen laufen zentral (2026-10-01)

**Der letzte englische Rest.** Löschen, Herunterladen, DICOM-DIR, Massen-Download
und die eigenen Schaltflächen bauten ihren Text selbst: `Failed to delete study.`
plus angehängter Correlation-Kennung — englisch, und am zentralen Übersetzungspunkt
vorbei. Dasselbe Muster gab es an vier Stellen im Aktivitäts-Detail
(`e.message : 'Failed'`) und beim Speichern einer Modalität.

Jetzt gibt es **einen** Helfer, `describeError(error, t)` in `src/lib/errors.ts`:

- `OrthancError` → sein (bereits übersetzter) Text **plus** die Correlation-Kennung
  über `errors.withRef` — die Kennung braucht der Support, um die Log-Zeile zu finden.
- Ein Fehler aus einer Aktion → seine eigene Aussage.
- Alles andere → `errors.unknown` („Etwas ist schiefgelaufen. Bitte erneut versuchen.").

Die Toasts sind damit überall gleich aufgebaut: **Titel = was fehlgeschlagen ist**
(übersetzt), **Beschreibung = warum** (übersetzt, mit Ref). Live geprüft: ein
abgebrochener Löschaufruf zeigt

```
Die Studie konnte nicht gelöscht werden
Keine Verbindung zum Server. Bitte erneut versuchen. (Ref: 4727dc89-…)
```

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **806 Tests**.

---

## v2.6.11 — Der „Mehr"-Dialog wird mitgeprüft (2026-10-01)

**Test-Änderung.** Der Screenshot-Audit öffnet jetzt den Dialog hinter „Mehr" und
prüft, dass **jede** Aktion eine Beschriftung trägt (ein fehlender Text würde einen
leeren Knopf zeigen) — auf Desktop und Mobil. Dabei fiel auf, dass die Studienliste
auf dem Telefon **Karten** statt einer Tabelle zeigt; der Audit adressiert jetzt
beides (`study-row` / `study-card`).

**33/33** Checks im Dialog-Durchlauf (vorher 29).

---

## v2.6.10 — Weniger Schaltflächen, verständliche Fehler (2026-10-01)

**Die Studien-Aktionsleiste zeigt nur noch, was im Alltag gebraucht wird.** Bis zu
15 Schaltflächen standen nebeneinander; jetzt sind es zehn in Gruppen (übertragen ·
ansehen · herunterladen · kennzeichnen · ändern · Datenschutz), und die seltenen
Aktionen liegen hinter **„Mehr"**:

- Im Dialog (nicht als Aufklapp-Menü): DICOM-DIR, migrieren/zusammenführen,
  aufteilen, Serie hinzufügen, Link teilen, Orthanc-API, löschen. Jede Aktion mit
  Icon und Beschriftung, der Löschen-Knopf in Rot — und alle weiterhin im
  Änderungsprotokoll.
- Ein Dialog statt eines Menüs, weil er jede Aktion **erklärt**, mit dem Finger
  bedienbar ist und im Test geprüft werden kann (Radix-Menüs öffnen sich in jsdom
  nicht — das hat der Testversuch gezeigt).

**Fehlertexte sind jetzt in der Sprache des Bedieners.** Die vorformulierten
HTTP-Texte standen in `errors.ts` fest auf Englisch — und damit in jedem Toast,
jedem Inline-Hinweis und jedem Dialog einer deutschen Oberfläche. Sie werden
jetzt **an der Quelle** übersetzt (i18next-Kern, englischer Text als Fallback),
statt an ~60 Anzeigestellen:

| vorher | jetzt (deutsch) |
|---|---|
| `A conflict occurred.` | „Das kollidiert mit dem, was schon da ist (z. B. gleicher Name)." |
| `The requested resource was not found.` | „Nicht gefunden — evtl. wurde es inzwischen gelöscht." |
| `Network error. Please try again.` | „Keine Verbindung zum Server. Bitte erneut versuchen." |
| `You are not authorized to perform this action.` | „Dafür fehlt Ihnen die Berechtigung." |

**Beschriftungen:** „Share" heißt **„Link teilen"**, „API" heißt
**„Orthanc-API öffnen"**.

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **802 Tests**.

---

## v2.6.9 — Nachbesserung an der Hilfe und der Aktionsleiste (2026-10-01)

Zwei Fehler aus v2.6.8, in der laufenden Oberfläche gesehen:

- **Der Hilfedialog der Basis-Seiten hieß „Was ist das?" statt „Studien — die
  Liste".** `PageHelp` hatte zwei Stellen, die noch fest auf `broker.*` zeigten
  (Titel und Einleitungssatz) — die Überschriften und Aufzählungen kamen schon
  aus dem `prefix`, der Titel nicht. Beides läuft jetzt über `prefix`.
- **Der Hilfe-Knopf stand mitten in den Aktionsschaltflächen** (zwischen „An
  Peer" und „Viewer") — er steht jetzt am Anfang der Leiste, die Aktionsgruppen
  bleiben zusammen. Die Trenner sind außerdem deutlicher (`bg-muted-foreground/40`,
  `h-6`), vorher waren sie kaum zu sehen.

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **801 Tests**, Screenshot-Audit 267/267.

---

## v2.6.8 — „Was ist das?" auf jeder Seite, Aktionsleiste gruppiert (2026-10-01)

**Hilfe war eine Broker-Eigenschaft.** Elf Broker-Seiten hatten einen Hilfetext,
die Basis-Seiten keinen. Jetzt trägt **jede** Arbeitsseite den Knopf „Was ist
das?" mit denselben drei Abschnitten (was ist das / wie bediene ich das / wenn
etwas nicht klappt):

- `PageHelp` liegt in `src/shared/components/` und nimmt ein `prefix`: der
  Broker-Slice schreibt weiter nach `broker.help_<id>_*`, die Basis nach
  `help.help_<id>_*`. Neu: Studien, Studie/Serie/Instanz im Detail, Hochladen,
  Aktivität, Änderungsprotokoll, Remote-Quellen, Einstellungen, Arbeitslisten,
  IID. Der Viewer bewusst **nicht** — das ist ein Werkzeug, keine Arbeitsseite.
- Der Screenshot-Audit prüft den Knopf auf jeder Ansicht. Das ist zugleich die
  Prüfung des Inhalts: fehlt ein Text, rendert der Knopf nicht (die Komponente
  gibt dann nichts aus) — der Audit schlägt fehl. **267 Checks** (vorher 225).

**Leere Trefferliste:** „0 Studien gefunden" bot keinen Weg zurück. Jetzt steht
dort **„Filter zurücksetzen"** — und nur dann, wenn wirklich ein Filter gesetzt
ist.

**Aktionsleiste:** die bis zu 15 Schaltflächen einer Studie sind jetzt gruppiert
(übertragen · herunterladen · kennzeichnen · ändern · Datenschutz · Werkzeuge)
mit dünnen Trennern, und **Senden/An Peer stehen vorn** statt hinter den
Download-Knöpfen. „Label" heißt auf Deutsch **„Kennzeichnung"**.

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **801 Tests**.

---

## v2.6.7 — Herkunft eines lokalen Eintrags: vier Werte, übersetzt (2026-10-01)

**Ein Fix aus der Wertemengen-Prüfung.** Der Client nannte `origin: 'manual' | 'hl7'`,
das Backend liefert aber auch `gdt` (Auftrag aus der Praxis-EDV) und `ups` (Work Item).
TypeScript konnte auf keinen der beiden einschränken, und das Badge druckte den Rohwert
in die Oberfläche.

- Das Schema deklariert die Menge jetzt als `Literal["hl7", "gdt", "manual", "ups"]` —
  im OpenAPI als `enum`, also auch für API-Nutzer sichtbar.
- Der Client nennt alle vier, und das Badge sagt „aus HL7" / „aus GDT" /
  „hier angelegt" / „Work Item" (Rohwert bleibt der Fallback).
- `PatientMerge.origin` ist ebenfalls eingeengt (`manual | adt`), und
  `CacheSourceOut.state` deklariert seine drei Werte — beide vom selben Check gefunden.

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **795 Tests**.

---

## v2.6.6 — Abdeckung wird erzwungen, nicht nur berichtet (2026-10-01)

**Die Abdeckung sinkt jetzt nicht mehr still.** Beide Ebenen prüfen sich selbst
und brechen den Build:

- `vitest.config.ts` → `coverage.thresholds` für den **Broker-Slice**
  (`src/features/broker/**` + `src/api/broker.ts`): 95 % Statements, 85 %
  Branches, 75 % Functions, 95 % Lines (Ist: 97,5 % / 86,3 % / 78,6 %).
- Der Umfang steht in derselben Datei: der Rest von OE3 gehört dem geteilten
  Fork und würde die Zahl nur verwässern (Gesamt-SPA liegt bei 49 %).
- Gegengeprüft: mit künstlich hochgesetzten Schwellen schlägt der Lauf fehl.

**Dazu die Lücken, die die Messung gezeigt hat** (Broker-Slice 95,8 → 97,5 %,
typisierter Client 86,9 → 99,0 %):

- `api/broker.test.ts`: eine Vertragsprüfung **pro Client-Methode** (Pfad +
  Verb) — die Page-Tests mocken den Client, ein falscher Pfad wäre erst in
  Produktion aufgefallen.
- `setting-rules`: die JSON-Feldzuordnung (leer/kaputt/Array/Nicht-Strings) und
  der Enum-Rückfall, wenn die API keine Auswahl mitliefert.
- `PrefetchPage`: nicht konfiguriert, teils zugestellt, Abweisung im Klartext.
- `AuditPage`: das Handy-Layout (Karten statt scrollender Tabelle).
- `use-form-draft`: Speicher, der sich verweigert (Privatmodus), und die
  Warnung vor dem Verlassen bei ungespeicherten Änderungen.

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **789 Tests**, Broker-Slice 97,5 % über den Schwellen.

---

## v2.6.5 — Kein horizontales Scrollen mehr, Change-Log in Worten (2026-10-01)

**Zwei Befunde aus dem laufenden Betrieb.**

**1. Die Studientabelle war immer breiter als ihr Container.** Gemeldet als
„ich muss im default desktop mode schon horizontal scrollen". Die Ursache war
ein Rechenfehler im automatischen Spalten-Layout: die Breite wurde proportional
verteilt und *danach* jede Spalte auf ihr Minimum hochgesetzt — ohne das
auszugleichen. Sobald eine Spalte ihr Minimum erreichte, war die Summe größer
als der Container: gemessen **+66 px bei 1024**, +26 px bei 1280, **+21 px bei
1440** — die Leiste erschien also auch auf einem breiten Bildschirm.

- `distributeColumnWidths` verteilt jetzt per **Water-Filling**: wer sein
  Minimum nicht erreicht, wird darauf festgesetzt, der Rest teilt den Rest —
  die Summe ist exakt die Containerbreite (Pixel-Rest wird ausgegeben, ein
  einzelnes Pixel zu viel zeigt schon eine Leiste).
- Kopfzeilen **kürzen mit Tooltip** statt in die Nachbarspalte zu laufen, und das
  Zellen-Padding der Studientabelle ist enger (`px-2` statt `px-4`, Kopf-Button
  ohne eigenes Padding) — bei 1024 px waren das ~30 % der Textbreite.
- Zwei weitere Stellen mit echtem Überhang bei 1024 px: die Prioritätsspalte der
  Quellen (jetzt erst ab `xl`) und die Echo-Matrix auf der Monitoring-Seite
  (Karten jetzt erst ab `xl` nebeneinander).

**2. Das Änderungsprotokoll zeigte rohe Aktionscodes.** „update.setting" statt
„Einstellung geändert": die Seite rendert `entry.action` direkt. Jetzt läuft sie
über `auditActionKey()` (Punkt → Unterstrich, weil i18next den Punkt als
Pfad-Trenner liest) mit **70 Labels** in en/de und dem Code als Fallback.
`tests/test_audit_action_labels.py` liest die Aktionen per AST aus dem Backend
(inkl. der f-String-Familien) und erzwingt ein Label — plus die Gegenrichtung:
kein Label ohne Aktion.

**Der Deep-UI-Audit hatte die Lücke, durch die das rutschte:** er prüfte nur
1400 px (Desktop) und 375 px (Mobil) — und nur den *Dokument*-Überhang, nicht
einen Container, der intern scrollt. Jetzt läuft eine **1024-px-Runde** mit
(`laptop`), und die Prüfung „keine scrollende Tabelle/Karte" misst die inneren
Scroller. **217 Checks** (vorher 161).

Gates grün: `tsc` 0, `npm run lint` 0, `npm run i18n:check` vollständig,
`npm run build` 0, **709 Tests**.

---

## v2.6.4 — Voraufnahmen-Seite und schreibgeschützte Deployment-Werte (2026-09-30)

**Neue Broker-Seite.** Der Broker kann seit dem letzten Workspace-Stand drei
Schnittstellen bedienen (GDT/BDT, UPS-RS-Abonnements, Voraufnahmen-Prefetch) —
für den Anwender am Befundplatz gab es dafür keine Oberfläche.

- Neu: `/broker/prefetch` („Prior studies" / „Voraufnahmen"). Patienten-ID,
  Abfrageknoten, Ziel, Modalität, maximale Anzahl; **erst Vorschau** (ein
  Studien-C-FIND verschiebt nichts), und erst danach wird „Holen" freigeschaltet.
  „Holen" braucht die Schreibrolle, die Vorschau nicht — genau wie die
  RBAC-Policy des Brokers es vorgibt. Darunter die UPS-RS-Ereignis-Abonnements
  mit Entfernen-Dialog.
- Die **Patienten-ID ist PHI** und liegt nur im Speicher (`useRememberedState`),
  nie im `localStorage` — dieselbe Regel wie bei den Suchfiltern.
- Neue i18n-Schlüssel in en/de (Seite, Hilfe-Seite `prefetch`, Fehlermeldungen).

**Deployment-eigene Einstellungen sind schreibgeschützt.** `spool_dir`,
`tls_dir`, `tls_inbound_port` und `instance_id` müssen zum Compose-Mapping bzw.
zum gemounteten Volume passen; ein Schreibzugriff über die Oberfläche hätte
gepufferte Bilder oder erzeugte Zertifikate auf das ephemere
Container-Dateisystem geschrieben. Die Karten zeigen den Wert jetzt nur noch an
und nennen den Grund, statt ein Eingabefeld anzubieten, das der Broker mit 409
ablehnt.

**Der Deep-UI-Audit** (`e2e/stack/verify-ui.cjs`) deckt die neue Seite mit ab —
Desktop 1400×900 und Mobil 375×812, damit sind es **161 Checks**.

Gates grün: `tsc` 0 Fehler, `npm run lint` 0 Fehler, `npm run i18n:check`
vollständig, `npm run build` 0 Fehler, **703 Tests**.

---

## v2.6.3 — Einstiegs-Anleitung für das geteilte Repo (2026-09-30)

**Doku, keine Code-Änderung.** Die Regeln standen verstreut (`CLAUDE.md`,
`release-process.md`, `backend-integration.md`); wer neu dazukommt — oder ein
zweites Produkt anbindet — konnte nirgends an einer Stelle lesen, was der
aktuelle Stand ist und wie er sich zu verhalten hat.

- Neu: [`docs/contributing-shared-fork.md`](contributing-shared-fork.md) —
  Startprozedur, aktueller Stand (Tags, kein `feat/mwl-broker`, kein
  Upstream-Tracking), die **fünf Regeln**, was eine eigene Integration nachziehen
  muss, Arbeitsweise (PR, Gates, Guard) und Verbote.
- **Neutral formuliert**: kein Produktname, keine interne Topologie — die Datei
  würde sonst Regel 1 und 2 selbst verletzen.
- `CLAUDE.md` → „Releases & Governance" verweist darauf.

Keine Code-Änderung: 696 Tests, `tsc`/`lint`/`i18n` unverändert grün.

---

## v2.6.2 — Upstream wird nicht mehr verfolgt (2026-09-30)

**Entscheidung, keine Code-Änderung.** Dieser Fork ist 105 Commits vor dem
Upstream-`main` (2026-04-12), hat die Studien-/Serien-Ebene umgebaut und den
MWL-Broker-Slice ergänzt — ein Merge der Upstream-Linie wäre ein Umbau, kein
Update. Upstreams Entwicklung lief ohnehin auf dessen `dev` weiter (2026-07-24,
80 Commits); die holen wir **bewusst nicht**.

- **README**: der Abschnitt „Upstream" sagt jetzt, dass nicht mehr getrackt wird
  — mit Begründung und Verweis auf `docs/next-steps.md` (B7) im Broker-Workspace.
- **MIT-Attribution bleibt**: Copyright-Notiz und Herkunftshinweis sind erhalten,
  auch ohne Tracking.
- Der `upstream`-Remote wurde entfernt. Der Push-Guard verweigert weiterhin
  Pushes, deren `origin` auf den Upstream zeigt — die Sicherung bleibt.

Keine Code-Änderung: 696 Tests, `tsc`/`lint`/`i18n` unverändert grün.

---

## v2.6.1 — Governance und Entkopplung (2026-09-30)

Patch-Release **ohne funktionale Änderung**. Dieser Fork ist die gemeinsame
OE3-Basis zweier Produkte; die Regeln dafür standen nirgends, und der Code trug
Name und Adresse eines davon.

### Regeln

- `CLAUDE.md` → „Releases & Governance": **Schichtung** (nichts
  Projektspezifisches ist Pflicht, kein Produktname im Repo), **Releases**
  (Konsumenten pinnen Tags, keine Branch-Heads), **Gate** (`main` nur über PR).
- Neu: [`docs/release-process.md`](release-process.md) — Checkliste zum Schneiden
  einer Release, inklusive Verhalten bei einer kaputten Release (Tag **nicht**
  verschieben).
- Neu: [`docs/backend-integration.md`](backend-integration.md) — wie ein zweites
  Produkt sein Backend anbindet (Opt-in-Flag, abgeleitete Basis-URL, 404 im
  Fremdstack).

### Entkopplung

- `src/api/pulmopath-pacs.ts` → `src/api/backend-pacs.ts` (neutral:
  `backendPacsApi`, `backend.pacs.failed`). Die Quarantäne bleibt **Opt-in**
  (`OPT_IN_FEATURES`) — das war bereits richtig.
- **Interne IP aus dem Code entfernt**: die Weasis-WADO-RS-URL in
  `StudyDetailPage` baute auf einer hartkodierten Adresse (für jedes andere
  Deployment kaputt) — jetzt `window.location.origin`.
- Die Produktions-E2E (`e2e/prod`) holt Instanz-URL, Backend-Container und
  JWT-`iss`/`aud` aus der Umgebung statt aus dem Code.

696 Tests, `tsc`/`lint`/`i18n` unverändert grün.

---

## v2.6.0 — OE3 als Werkzeug: Split & Merge, echtes Query/Retrieve, Dokumente (2026-09-30)

Sechs Sprints („Schweizer Taschenmesser", Roadmap:
[`docs/plans/2026-09-25-oe3-swiss-army-knife-roadmap.md`](plans/2026-09-25-oe3-swiss-army-knife-roadmap.md)),
die OE3 von der Anzeige- zur Arbeitsfläche machen — plus ein Aufräum-Commit
davor. Alle Änderungen an der OE3-Oberfläche selbst, **nicht** am Broker-Slice.

### Aufräumen (vor den Sprints)

- **Activity-Timeline**: Job-Fehler wurden nicht angezeigt.
- **UI-Zustand überlebt den Tab-Wechsel**: `src/store/ui-state.ts` mit
  `usePersistedState` (localStorage, **nur PHI-freie Werte**) und
  `useRememberedState` (nur im Speicher, für alles, was PHI tragen kann).
  Filter, Spalten, Breiten, Sortierung und Ansichtsmodus gehen jetzt darüber.
- **Automatisches Spalten-Layout** (`src/features/studies/lib/column-layout.ts`):
  `distributeColumnWidths()` verteilt die Container-Breite proportional über die
  sichtbaren Spalten (nie unter `minSize`), manuell gesetzte Breiten werden
  darübergelegt.
- **Quarantäne** (Backend-Endpunkt) als **Opt-in**-Feature.
- Multiselect-Parität zwischen Liste und Detail.

### Sprint 1 — Merge- & Modify-Integrität

- **`FailedInstancesCount` wird ausgewertet**: Orthanc antwortet bei
  Merge-Teilausfällen mit HTTP 200 — die UI meldete das bisher als vollen Erfolg.
- **Cross-Patient-Mismatch-Schutz** vor jedem Merge (gleicher Patient grün,
  abweichend gelb/rot, Sicherheitsabfrage).
- **Audit-Seam geschlossen**: `migrateSeriesAction` / `migrateInstanceAction`
  emittieren `series.migrate` / `instance.migrate` — die Dialoge riefen vorher
  direkt die API auf, ohne AuditEvent.
- **Atomarer Batch-Merge** statt seriellem Loop in `MigrateStudyDialog`.
- **404-Falle nach Modify behoben**: bei `KeepSource: false` löscht Orthanc die
  alte ID; die UI navigiert jetzt auf die neue ID.

### Sprint 2 — Echtes DICOM Query & Retrieve (C-FIND / C-MOVE)

- **`src/api/queries.ts`** bindet die realen Orthanc-Routen an
  (`POST /modalities/:name/query`, `GET /queries/:id/answers`,
  `.../answers/:index/content`, `.../answers/:index/retrieve`,
  `DELETE /queries/:id`).
- Die frühere `RemoteSourcesPage` benutzte **nicht existierende Endpunkte**
  (`/modalities/:name/query/:id/retrieve`) — jetzt echte Abfrage-Pipeline mit
  Fortschritt, Ergebnistabelle und Import-Status.
- Auditierte Actions `queryModalityAction` (`modality.query`) und
  `retrieveModalityAction` (`modality.retrieve`).

### Sprint 3 — Dokumente im Browser

- **`InstanceDocumentViewer`**: Encapsulated PDF (`/instances/:id/pdf` im
  iframe) und **DICOM Structured Reports** (strukturierte Baum-/Textansicht)
  statt Binär-Download.

### Sprint 4 — Anonymisierungs-Profile & UID-Lookup

- **PS-3.15-Presets** im `AnonymizeDialog` (`Full`, `Clinical`, `De-Identify`).
- **Globales UID-Lookup** (`UidLookupDialog`, `/tools/lookup`): löst jede
  UID/UUID auf und navigiert zur passenden Route.

### Sprint 5 — Peer-to-Peer-Transfer

- **`SendToPeerDialog`** auf Studien- und Serienebene, `sendToPeerAction`
  (Audit `peer.send`) — direktes HTTP-Senden an einen Orthanc-Peer.

### Sprint 6 — Split & Merge (Cut & Paste)

- **`POST /studies/:id/split`** angebunden (`splitStudyAction`, Audit
  `study.split`) mit `SplitStudyDialog`: ausgewählte Serien/Instanzen in eine
  neue Studie ausgliedern (neue StudyInstanceUID, `KeepSource`-Toggle).
- **`StudyDetailPage`**: „Aufteilen" in der Aktionsleiste + Bulk-Aktion in der
  Serientabelle.
- **`SeriesDetailPage`**: Instanz-Multiselect (Tabelle und Raster) mit
  „In Studie verschieben" (`moveInstancesToSeriesAction`), „In neue Studie
  abspalten", „Download ZIP" und „Löschen".

### Weitere Änderungen

- **Mehrstudien-Export** als ZIP (`exportStudiesAction`, Audit `study.export`).
- **`StudyLabelDialog`**: ein Label auf eine oder viele Studien (Liste + Detail
  teilen sich den Dialog).
- **`use-remembered-search-params.ts`**: Filterabfrage überlebt den Tab-Wechsel,
  Deep-Link gewinnt, Leeren der Filter löscht die Erinnerung.

### Tests & Tooling

- **696 Unit-Tests** (Vitest, 133 Dateien), `tsc --noEmit` 0 Fehler,
  `npm run lint` 0 Fehler, `npm run i18n:check` 100 % (9 Sprachen).
- Neue Suiten u. a.: `splitStudy`, `sendToPeer`, `quarantineStudy`,
  `queryModality`/`retrieveModality`, `moveInstancesToSeries`,
  `migrateInstance`/`migrateSeries`, `column-layout`, `ui-state`,
  `use-remembered-search-params`, `dicom-uid`, `backend-pacs`.

---

## v2.5.0 — Broker-Betrieb, PIR, Barrierefreiheit und Standalone (2026-09-23)

Seit v2.4.0 ist der Broker-UI-Slice deutlich gewachsen. Die wichtigsten
Änderungen dieser Runde:

### Neu: OE3 allein betreiben

- **Der Broker ist abschaltbar**: ohne `brokerUrl` **und** mit
  `enableMwlBroker: false` verschwindet der Abschnitt aus der Navigation, und die
  Routen zeigen eine Erklärung (`BrokerGate`) statt einer Konsole, deren jede
  Anfrage scheitert.
- **Viewer-Liste aus der Konfiguration**: `viewers` in `config.js` schlägt die
  Browser-Liste (vorher lag sie nur im `localStorage` jedes Anwenders),
  `viewersLocked: true` macht sie schreibgeschützt. Auch der IHE-Bildaufruf
  (RAD-106) folgt der Vorgabe.
- Vollständige Referenz: [`docs/oe3-standalone.md`](oe3-standalone.md).

### Neu: drei API-Fähigkeiten, die keine Oberfläche hatten

- **MPPS-Einzelschritt nachmelden** (die Karte zeigte, *welcher* Schritt vom RIS
  abgelehnt wurde — nachmelden konnte man nur alle).
- **Cache je Quelle verwerfen** (der Zustand stand je Quelle da, die Aktion nicht).
- **Store-Log** (Zeit, Calling-AET, Zugangsnr., Status, Fehler) — und genau dieser
  bis dahin ungenutzte Endpunkt antwortete **500** für Altzeilen
  (`applied_transforms = NULL`); der Backend-Fix steht im Broker-Repo.

### Neu: alle neun Sprachen vollständig — und Arabisch rechtsläufig

- **Der Broker-Slice ist in allen neun Sprachen übersetzt** (en, de, es, fr, ja,
  ru, tr, zh, ar) — abschnittsweise, damit keine Seite gemischtsprachig wird.
  Vorher trugen sieben Sprachen nur den Rahmen und fielen auf Englisch zurück.
- **Arabisch ist rechtsläufig** ✗→✓: `<html dir>`/`lang` folgen der Sprache
  (`src/i18n/direction.ts`), die Seitenleiste nutzt jetzt logische Insets
  (`start`/`end`) und wandert nach rechts, und Zahlen mit lateinischen Einheiten
  („25 ms") laufen über `.ltr-value` isoliert, damit die Bidi-Regeln sie nicht
  umstellen. Geprüft per Screenshot (Desktop + Mobil) und im DOM-Audit
  („Schreibrichtung folgt der Sprache").
- Zwei Lücken außerhalb des Brokers mitgenommen: `nav.auditLogs` fehlte in allen
  Locales und „Toggle Sidebar" war hartkodiert — beides jetzt übersetzt.

### Weitere Änderungen

- **MWL-Interop-Schalter** je Quelle: `QueryRetrieveLevel (0008,0052)` weglassen —
  manche fremden MWL-SCPs matchen darauf und liefern sonst nichts.
- **Änderungsprotokoll**: vier Entities (PIR-Merge, Feldregeln, MPPS-Schritte,
  HL7-Feldzuordnung) zeigten rohe Schlüssel — jetzt in allen neun Sprachen
  beschriftet.
- **Einstellungen**: 15 Werte (HA, MPPS, HL7) hatten keinen Klartext im UI.
- **Barrierefreiheit/Mobile**: Tabellenzeilen klickbar (Maus + Enter/Leertaste),
  Dialoge passen auf 375 px, Badges brechen nicht mehr um, Formularentwürfe
  gegen Datenverlust.
- **i18n**: die neuen Texte liegen in **allen neun** Sprachen; die
  Chrome-Prüfliste (`scripts/check-i18n.mjs`) erzwingt sie.
- **Audits**: `verify-ui.cjs` prüft 154 Punkte (Desktop + Mobil, inkl.
  „keine rohen Schlüssel" auf jeder Seite), `verify-screens.cjs` 225 über alle
  Ansichten und Dialoge.

---

## v2.4.0 — MWL Broker (Worklist-Proxy, Routing, TLS, Betrieb) (2026-09-18)

Diese Version bringt den kompletten **MWL-Broker**: einen DICOM-Modality-
Worklist-Proxy mit mehreren RIS/KIS-Quellen, Worklist-Cache, C-STORE-Spool,
Routing/Transform-Regeln, lokaler Worklist mit HL7-ORM, Stationsregeln,
ATNA-Audit-Export, DICOM-TLS/mTLS, RBAC, Aufbewahrungskonzepten, Alerting,
Health-Panel, „Was ist das?"-Hilfe je Seite, Formular-Entwürfen und
Übersetzungen für alle neun Sprachen (Rahmen). Details unten.

### MWL Broker UI + Standalone-Deployment-Härtungen

### Neu: MWL-Broker-Konfiguration (nicht nur Monitoring)

- Sechs Broker-Seiten: `/broker` (Monitoring) plus `/broker/sources`,
  `/targets`, `/rules`, `/transforms`, `/settings` — als Sidebar-Untergruppe.
- Vollständiges CRUD für Upstream-Quellen (RIS/KIS) und Store-Ziele (PACS)
  inkl. Enable/Disable, Priorität, Charset und C-ECHO-Test pro Knoten.
- Routing-Regeln (Quelle → Ziel) und **DICOM-Modify-Regeln** (Tag
  `set`/`remove`/`prefix`/`suffix`/`replace`/`copy`, Scope je Quelle/Ziel,
  Priorität) — Validierung gegen das DICOM-Datenlexikon erfolgt broker-seitig,
  422-Meldungen werden im Dialog angezeigt.
- Laufzeit-Settings mit ENV-Default: Override und Reset pro Schlüssel.
- Alle Schreibvorgänge laufen über `use-broker-writes.ts` und emittieren
  BEFORE+AFTER-Audit-Events (`broker.*`-Actions, neue `brokerSource`,
  `brokerTarget`, `brokerRule`, `brokerTransform`, `brokerSetting`
  Ressourcentypen).

### Neu: i18n aufgeräumt (alle 9 Sprachen)

- **Nur react-i18next**: `useTranslation()` in Komponenten **und** Hooks, kein
  eigenes `t()` — abgesichert durch `src/features/broker/i18n-usage.test.ts`.
- **Der Broker-Rahmen ist in allen neun OE3-Sprachen übersetzt** (Titel,
  Untertitel, Tabellenköpfe, Knöpfe, Lösch-/Verwerfen-Dialoge, Hilfe-Überschriften);
  die ausführlichen Texte liegen auf Deutsch und Englisch vor und fallen
  schlüsselweise auf Englisch zurück — nie auf einen Rohschlüssel.
- **Debuggen**: `?lng=fr` erzwingt eine Sprache, `?i18nDebug=1` schaltet das
  i18next-Logging ein (fehlende Schlüssel werden gemeldet), `window.__i18n` steht
  in der Konsole bereit; die Standardsprache kommt aus den Browser-Einstellungen.
- **`npm run i18n:check`** zeigt die Abdeckung je Sprache und schlägt fehl, wenn
  eine Sprache fehlt, die Referenzsprachen auseinanderlaufen oder ein
  Rahmen-Schlüssel fehlt (läuft in `ci-local.sh` und im GitHub-Workflow).
- Der Guard hat zwei echte Lücken gefunden: `broker.addTitle`/`broker.editTitle`
  fehlten (der Fallback im Knoten-Dialog hätte den Rohschlüssel angezeigt).

### Neu: RBAC-Banner, Retention-Karte, flexibles Alerting

- **RBAC**: der Proxy entscheidet über die Rollen (`X-OE3-Roles`), der Broker
  erzwingt Lesen vs. Schreiben. Die UI zeigt Lesern einen Banner („Rolle
  `brokerWrite` fehlt") statt 403er-Fehlern; Default aus.
- **Retention-Karte**: pro Tabelle Zeilen/ältester Eintrag/Aufbewahrung
  („für immer" ausdrücklich als Text) + „Jetzt aufräumen" (bestätigt, auditiert).
- **Alerting**: mehrere Webhook-Ziele (Komma-getrennt) werden parallel beliefert.
- 441 Unit-Tests (Vitest), Playwright-Suite mit 48 Tests, `verify-ui.cjs` mit
  109 Checks.

### Neu: DICOM-TLS/mTLS und Zertifikatsverwaltung

- **TLS-Karte** auf der Broker-Settings-Seite: Listener mit Port und Zustand,
  mTLS-Auswahl, Zertifikatsfelder mit **Ablauf-Badges**, Erzeugung
  selbstsignierter Zertifikate (PEM-Anzeige zum Weitergeben) und eine
  **Endpunkt-Prüfung** (echter Handshake mit Protokoll/Cipher/Peer-Zertifikat,
  optional C-ECHO über TLS).
- **TLS-Gruppe** im Quellen- und Ziel-Dialog (TLS an/aus, Verifikation mit
  Warnhinweis).
- Defaults bleiben unverändert: TLS ist aus, Verifikation an — eine
  LAN/VPN-Installation läuft ohne Anpassung weiter.
- 435 Unit-Tests (Vitest), Playwright-Suite mit 46 Tests, `verify-ui.cjs` mit
  104 Checks.

### Neu: lokale Worklist, Stationsregeln, ATNA

- **`/broker/worklist`**: lokale Worklist-Einträge (Notfälle, ungeplante
  Untersuchungen) mit CRUD, Gültigkeit und Herkunft; daneben das **HL7-Panel**
  (Nachricht einfügen → „Prüfen (Trockenlauf)" zeigt das Parse-Ergebnis samt
  Warnungen, „Anwenden" schreibt) und die letzten empfangenen Nachrichten.
- **`/broker/stations`**: Stationsregeln (Quellen verbergen/erlauben,
  Prioritäts-Override) mit **Vorschau** — „welche Quellen sieht diese Konsole?".
- **ATNA-Karte** auf der Settings-Seite: Audit-Trail an die eigene
  Audit-Record-Repository (TCP/TLS), Zustand/Puffer, Testversand und die
  Beispielnachricht als XML.
- Alle Mutationen laufen über auditierte Hooks (`broker.local_item.*`,
  `broker.hl7.orm`, `broker.station_rule.*`); Mobile überall als Cards.
- 428 Unit-Tests (Vitest), Playwright-Suite mit 44 Tests (Notfall in der Liste,
  HL7-Trockenlauf, Stationsvorschau, ATNA-Beispiel + Testversand),
  `verify-ui.cjs` jetzt mit 100 Checks.

### Neu: Alerting-Karte (Webhook)

- Eigene **Alerting-Karte** auf der Broker-Settings-Seite: Webhook-URL mit
  Override/Reset, **Ereignisauswahl als Checkboxen** (Code, Severity und
  Beschreibung kommen aus `GET /notify/events`) und **„Testnachricht senden"**
  mit Ergebnisanzeige.
- Die drei Alerting-Schlüssel erscheinen nicht mehr in der generischen
  Einstellungsliste (ein CSV-Feld wäre die falsche Bedienform).
- Semantik: Zustellung fire-and-forget (ein langsamer Webhook verzögert nie
  DICOM-Verkehr), nur Übergänge werden gemeldet, gleiche Ereignisse je Objekt
  gedämpft, Webhook-URL nie vollständig im Log.

### Neu: Store-Warteschlange (C-STORE-Spool)

- **Spool-Karte** im Dashboard: Rückstand, ältester Eintrag, Belegung,
  Dead-Letter-Badge und „Alle erneut senden" (bestätigt, auditiert).
- Seite **`/broker/spool`** („Store-Warteschlange"): Filter nach Status, je
  Eintrag Ziel/Versuche/Größe/letzter Fehler, „Jetzt erneut senden" und
  „Verwerfen" mit **Pflicht-Begründung** (der Dialog erklärt den Verlust).
- Semantik: nicht zustellbare Instanzen werden gepuffert und automatisch
  wiederholt; bei vollem Budget weist der Broker ab, statt still zu verwerfen.
- Mobile: Einträge als Cards; Retry/Verwerfen laufen über auditierte Mutations
  (`broker.spool.*`).

### Neu: Worklist-Cache mit Stale-Fallback

- **Cache-Karte** im Dashboard: Einträge, Alter und Zustand (`empty |
  available | expired`) je Quelle, Fallback-Flag, Refresh-Intervall und
  „Cache leeren" mit Bestätigung (auditiert als `broker.cache.clear`).
- **Warnbanner**, solange der jüngste Query aus dem Cache bedient wurde, und
  ein „aus Cache"-Marker im Query-Log.
- Quellen-Dialog: Cache-Gruppe (Fallback-Schalter, Hintergrund-Aktualisierung).
- Die globalen Schalter (Cache an/aus, Stale-Fenster, erledigte Schritte
  ausblenden, max. Einträge) erscheinen automatisch auf der Settings-Seite.
- Semantik: eine Live-Antwort **ersetzt** den Snapshot — abgeschlossene
  Aufträge verschwinden sofort; erledigte Schritte kommen nie aus dem Cache.

### Neu: Änderungsprotokoll, Export/Import und Simulation

- Seite **`/broker/audit`** („Änderungsprotokoll"): jede
  Konfigurationsänderung mit Feld-Diff (Vorher/Nachher), **Rollback** mit
  Bestätigung, **Export** der Gesamtkonfiguration als Datei und **Import** mit
  verpflichtendem Dry-Run-Diff (inkl. übersprungener Einträge) vor dem Anwenden.
- **„Fall prüfen" (Simulation)** auf `/broker`: Accession/Study-UID plus
  optionale `Tag=Wert`-Zeilen zeigen Routing-Entscheidung, angewendete
  Modify-Regeln und den Tag-Diff — ohne Versand.
- Mobile: Audit-Einträge als Cards; Rollback/Import laufen über auditierte
  Mutations (`broker.config.*`, neuer Ressourcentyp `brokerConfig`).

### Neu: Broker-Health-Panel + Circuit-Breaker-Anzeige

- `/broker` zeigt oben ein **Konfigurations-Check-Panel**: Befunde nach
  Schweregrad, lokalisierter handlungsorientierter Satz, Deep-Link („Beheben")
  ins betroffene Formular, englischer API-Text als Fallback.
- **Circuit-Breaker-Badge** je Quelle (offen/halb-offen mit Restzeit,
  Ein-Klick-Reset mit Audit-Event `broker.source.breaker_reset`) in
  Quellentabelle, Mobile-Cards und Monitoring.
- Sidebar-Badge am „MWL Broker"-Eintrag (Fehler rot, sonst Warnungen).
- Query-Log kennzeichnet übersprungene Quellen als „übersprungen (Breaker)".
- Löschdialoge weisen auf mitentfernte Abhängigkeiten hin (Regeln/Transforms).

### Neu: Standalone-Deployment-Flags

- `authCheck: false` — überspringt das `/oe3-me`-Gate in Deployments ohne
  Backend-Proxy (vorher blockierte ein 404 die gesamte App).
- `viewerSession: false` — überspringt `POST /api/v1/pacs/viewer-session`
  vor dem Öffnen eines Viewers (Endpoint existiert nur hinter dem Proxy).
  Beide Defaults bleiben `true`; Produktivverhalten unverändert.

### Fixes

- `tools.getLabels` nutzte `/labels` (404) statt `/tools/labels`.
- Mobile Sidebar: `sr-only` Sheet-Titel ergänzt (Radix-A11y-Warnung).
- Broker-Tabellen rendern unterhalb `md` als Cards — Action-Buttons wurden bei
  375 px abgeschnitten; DICOM-Endpunkte brechen nicht mehr mitten im Token.
- `ConfigRowCard` rendert seine Badges (default/disabled fehlten auf Mobile).

### Tests & Tooling

- 441 Unit-Tests (Vitest), `e2e/stack/` Playwright-Suite (Desktop 1280×800 +
  Mobile 375×812, 48 Tests) und `e2e/stack/verify-ui.cjs` als Deep-Audit
  (109 Checks, CRUD-Flows gegen die REST-API gegengeprüft, Screenshots).
- Coverage-Tooling (`@vitest/coverage-v8`); Broker-UI bei 97,9 %.

---

## v2.3.0 — DICOM Upload + Merge: Patient-Safe Matching (2026-09-08)

### Critical: Cross-patient merge prevention

- **`addDicomToStudyAction` now pre-validates patient identity before `POST /studies/{id}/merge`.**
- Prevents accidental merges of DICOM from a different patient into the target study.
- Mismatched source studies are reported as `skipped` instead of merged.
- UI shows a dedicated `study.addDicomPatientMismatch` toast.

### High: Umlaut- and DICOM-PN-aware patient matching

- New utility `src/lib/dicom-patient-matching.ts` ports simplified logic from PP-Portal `PatientIdNormalizationService`:
  - Parses DICOM `PatientName` (`LastName^FirstName^...`).
  - Generates Umlaut-safe name variants (`ü` ↔ `ue`, `ö` ↔ `oe`, `ä` ↔ `ae`, `ß` ↔ `ss`).
  - Normalizes `PatientBirthDate` from `YYYYMMDD` to `YYYY-MM-DD`.
  - First-name prefix matching (`Hans-P` matches `Hans-Peter`).
- Matching strategy:
  1. Exact `PatientID` match, if present on both sides.
  2. Fallback: last-name + first-name + birth-date match (Umlaut-safe).
  3. Missing birth date on either side → no match (conservative).

### High: DICOM upload/merge audit trail

- `addDicomToStudyAction` emits `study.addDicom` (started/success/failure) and per-file `instance.upload` (started/success/failure) events.
- Audit detail includes `uploaded`, `failed`, `merged`, `skipped`, `mismatchedStudyIds`.
- `errorCode` is captured for upload failures.

### Medium: Add Series dialog improvements

- DICOM mode now reports partial results (`uploaded`, `failed`, `merged`, `skipped`).
- Patient mismatch displayed via dedicated i18n toast.
- File sizes use shared `formatDiskSize` utility.

### Tests added

- `src/lib/dicom-patient-matching.test.ts` (24 tests): PN parsing, Umlaut variants, date normalization, match/no-match cases.
- `src/actions/addDicomToStudy.test.ts` (7 tests): same-patient merge, umlaut-spelling merge, different-patient skip, upload failure, progress callback, merge error propagation.

### Verification

- `npx tsc --noEmit -p tsconfig.app.json`: 0 errors.
- `npx vitest run`: 249/249 tests passing.

### Files changed

```text
Added:
  src/lib/dicom-patient-matching.ts
  src/lib/dicom-patient-matching.test.ts
  src/actions/addDicomToStudy.test.ts

Modified:
  src/actions/addDicomToStudy.ts
  src/features/studies/components/AddSeriesDialog.tsx
  src/i18n/locales/de.json
  src/i18n/locales/en.json
  docs/fork-changelog.md
```

---

## v2.2.0 — CI Pipeline + audit-ci (2026-09-06)

### GitHub Actions CI Pipeline

- **Neue CI** (`.github/workflows/ci.yml`) — 4 Jobs, laeuft bei PR + Push auf main:
  - `typecheck`: `tsc --noEmit -p tsconfig.app.json`
  - `lint`: `npm run lint` (ESLint)
  - `test`: `npm run test` (Vitest, 218 Tests)
  - `audit`: `npm run audit` (audit-ci, high+critical blocking)
- Keine Datenbank-Abhaengigkeit — alle Tests sind reine Unit/Component-Tests mit jsdom.
- Kein Postgres/Redis Service noetig (wie beim PP-Backend).

### audit-ci — Strukturierter Dependency-Scan

- **`.audit-ci.jsonc`** konfiguriert: high+critical blocking, moderate non-blocking.
- **5 GHSA-IDs allowlisted** (dev-dependencies, nicht in Production-Build):
  - `GHSA-52cp-r559-cp3m` — js-yaml (via markdownlint-cli2, dev-only)
  - `GHSA-5p4m-2wfm-xmqj` — js-yaml (via markdownlint-cli2, dev-only)
  - `GHSA-mh29-5h37-fv8m` — js-yaml prototype pollution (via markdownlint-cli2, dev-only)
  - `GHSA-4w7w-66w2-5vf9` — js-yaml (via markdownlint-cli2, dev-only)
  - `GHSA-fx2h-pf6j-xcff` — Vite path traversal in dev server (dev-only, nicht in production builds)
- `npm run audit` Script zum manuellen Ausfuehren.

### Files Changed

```text
Added:
  .github/workflows/ci.yml
  .audit-ci.jsonc

Modified:
  CLAUDE.md
  docs/fork-changelog.md
  package.json
  package-lock.json
```

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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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

```text
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
