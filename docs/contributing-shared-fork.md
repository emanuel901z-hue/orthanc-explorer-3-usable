# Arbeiten in diesem Repo (gemeinsame Basis)

Dieses Repository ist die **gemeinsame OE3-Basis zweier Produkte**: dem
öffentlichen MWL-Broker-Workspace und einem internen PACS-Projekt, das seinen
eigenen Stack betreibt. Beide arbeiten auf `main` und konsumieren dieselben
Komponenten. Diese Seite ist die Einstiegs-Anleitung: **was der Stand ist, wie du
dich verhältst und was zu beachten ist.**

Die verbindlichen Regeln stehen in [`CLAUDE.md`](../CLAUDE.md#releases--governance);
der Release-Ablauf in [`release-process.md`](release-process.md); wie ein Produkt
sein eigenes Backend anbindet, in [`backend-integration.md`](backend-integration.md).

## Startprozedur

```bash
git fetch origin && git checkout main && git pull --ff-only
```

Dann lesen:

- [`CLAUDE.md`](../CLAUDE.md) → Abschnitt **„Releases & Governance"**
- [`release-process.md`](release-process.md)
- [`backend-integration.md`](backend-integration.md)
- [`../README.md`](../README.md) → Abschnitt **„Upstream"**

## Stand (30.09.2026)

| | |
|---|---|
| **Releases** | `v2.6.0`, `v2.6.1`, `v2.6.2` — **pinne den Tag**, nie einen Branch-Head |
| **`feat/mwl-broker`** | **existiert nicht mehr** — vollständig in `main` gemerged und gelöscht. Nicht auschecken, nicht wiederbeleben |
| **Upstream** | **wird nicht mehr verfolgt.** Dieses Repo ist bewusst divergiert (Stand 30.09.2026: 105 Commits vor dem Upstream-`main`, Studien-/Serien-Ebene umgebaut, Broker-Slice ergänzt). Nicht wieder hinzufügen, **nicht mergen** — brauchst du einen einzelnen Upstream-Fix, Remote temporär hinzufügen und **gezielt cherry-picken**. MIT-Attribution bleibt |
| **Push-Guard** | pusht auch **neue annotierte Tags** (nach demselben Audit) |

## Die fünf Regeln (verbindlich)

| # | Regel | Konkret |
|---|---|---|
| 1 | **Kein Produktname im Repo** | keine produktnamigen Datei-, Symbol- oder Log-Namen, keine Produktbezüge in Kommentaren. Neutral bleiben: `backend-pacs`, `backendPacsApi`, `backend.pacs.failed`. Die eigene Beschriftung gehört in die **Deployment-Config**, nicht in den Code |
| 2 | **Keine interne Topologie im Repo** | keine IPs, Container-Namen, Secret-Pfade, JWT-`iss`/`aud` im Code. Braucht ein Test sie → **Umgebungsvariable mit neutralem Default** (Muster: `e2e/prod/*`) |
| 3 | **Projekt-spezifisch = Opt-in** | Flag in `OPT_IN_FEATURES` (`src/config/features.ts`), Default **aus**; ohne das zugehörige Backend muss der Stack fehlerfrei starten (404 statt Konsolenfehler) |
| 4 | **Eigene Dateien, keine fremden** | eigener Code in `src/features/<domain>/` und `src/api/<domain>-*.ts`. **Nicht anfassen:** `StudyListPage`, `StudyDetailPage`, `SeriesDetailPage`, `AppLayout`, `src/lib/*`, geteilte `src/actions/*`, `src/features/broker/**` — genau dort kollidieren die Produkte. Brauchst du dort eine Änderung → **eigener PR mit Begründung**, kein Nebenprodukt eines Features |
| 5 | **Upstream nicht verfolgen** | siehe „Stand" — kein Merge der Upstream-Linie, nur gezieltes Cherry-picken einzelner Fixes |

## Wenn du eigene Integrationen mitbringst

1. **Umbenennungen nachziehen** (Beispiel aus der letzten Runde):
   `src/api/<alt>-pacs.ts` → `src/api/backend-pacs.ts`,
   `<alt>PacsApi` → `backendPacsApi`, Log-Event `<alt>.pacs.failed` → `backend.pacs.failed`.
2. **Opt-in-Flag** statt Sichtbarkeit per Deployment-Zufall (`OPT_IN_FEATURES`).
3. **Feste Adressen durch die Laufzeitumgebung ersetzen** — im Browser
   `window.location.origin`, in Tests Umgebungsvariablen.
4. **Deployment-Werte in die Pipeline**, nicht in den Code — die Produktions-E2E
   liest `OE3_PROD_BASE`, `OE3_PROD_BACKEND_CONTAINER`, `OE3_PROD_JWT_ISS`,
   `OE3_PROD_JWT_AUD` (der JWT-Schlüssel liegt im Backend-Container unter
   `/run/secrets/jwt_secret`).
5. **Fork als Submodule?** Auf einen **Tag** pinnen, nicht auf `main`.

## Arbeitsweise

1. Branch von `main` → arbeiten.
2. **Gates vor dem PR** (alle grün):
   `npx tsc --noEmit -p tsconfig.app.json` · `npm run test` · `npm run lint` ·
   `npm run i18n:check` · `npm run build`
3. **PR gegen `main`** — kein Direkt-Push.
4. **Merge und Push nach `origin` laufen über den Guard**
   (`orthanc-dicommwl-broker/pre-push-fork.sh` — auditiert Commits, Dateien und
   neue Tags). Ein Merge direkt im GitHub-UI **umgeht diese Prüfung**; dann vorher
   die Gates fahren und den Diff selbst ansehen. Kannst du den Guard nicht nutzen:
   melde dich, dann braucht es einen gleichwertigen Guard.
5. **Release** nach [`release-process.md`](release-process.md): Changelog und
   Testzahlen aktualisieren, Tag `vX.Y.Z`, Push über den Guard.
6. **Einen gepushten Tag nie verschieben** — stattdessen `vX.Y.(Z+1)`.

## Verboten

Direkt-Push auf `main` · Tags verschieben · geteilte Komponenten umschreiben ·
Produktnamen oder interne Topologie ins Repo schreiben · eine backend-abhängige
Funktion ohne Opt-in-Flag auf `main` legen · den Upstream-Remote wieder
hinzufügen oder die Upstream-Linie mergen.
