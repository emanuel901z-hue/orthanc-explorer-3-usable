# Ein zweites Produkt an diesen Fork anbinden

Dieser Fork ist die **gemeinsame OE3-Basis zweier Produkte** (öffentlicher
MWL-Broker-Workspace + internes PACS-Projekt mit eigenem privatem Stack). Die
Schichtungsregel steht in [`CLAUDE.md`](../CLAUDE.md#releases--governance); hier
steht, **wie** ein Produkt seine eigene Backend-Anbindung anbringt, ohne
gemeinsamen Code zu verändern.

## Grundsatz

> Ein Produkt bringt seine Besonderheiten über **Konfiguration und Opt-in-Flags**
> an — nie, indem es gemeinsame Komponenten umschreibt oder seinen Produktnamen
> in dieses Repository trägt.

Damit bleiben beide Produkte auf demselben `main`, und ein Deployment ohne das
jeweils andere Backend startet trotzdem fehlerfrei (keine scheiternden Requests,
keine Konsole-Fehler).

## Der Opt-in-Seam

Neue, backend-abhängige Funktionen gehören in `OPT_IN_FEATURES`
(`src/config/features.ts`): **standardmäßig aus**, nur bei explizitem
`true` (kanonischer Schlüssel oder `enableX`-Alias) sichtbar.

```ts
const OPT_IN_FEATURES = new Set<FeatureKey>(['quarantine']);
```

Ein Deployment aktiviert sie in seiner `config.js`:

```js
features: { enableQuarantine: true }
```

Ohne das Flag erscheint der Knopf nicht — und es wird auch keine Anfrage
abgesetzt.

## Die Backend-API-Basis

`src/api/backend-pacs.ts` leitet die Basis aus `orthancUrl` ab: endet sie auf
`/orthanc`, wird das abgeschnitten (`/api/v1/pacs/orthanc` → `/api/v1/pacs`),
sonst bleibt `/api/v1/pacs` als Fallback. In einem Stack **ohne** dieses Backend
antwortet der Endpunkt schlicht 404 — der Fehler ist damit sichtbar und lokal,
nicht global.

Erwarteter Vertrag (Beispiel Quarantäne):

| Methode | Pfad | Antwort |
|---|---|---|
| `POST` | `/api/v1/pacs/quarantine/adopt` | `{ success, orthancStudyId, previousOrthancStudyId, quarantinePatientId, … }` |

`400`/`404`/`409` dürfen eine **operative, PHI-freie** Meldung im Feld `error`
tragen — sie wird in der Oberfläche angezeigt. Alle anderen Status behalten die
gescrubbte Standardmeldung.

## WADO-RS für Desktop-Viewer

Der Weasis-Aufruf auf der Studienseite baut seine WADO-RS-URL aus
`window.location.origin` (nie eine hartkodierte Adresse) plus dem Pfad
`/api/v1/pacs/orthanc/wado-rs/studies/<UID>` — einer Backend-Proxy-Konvention.
Ein Deployment mit anderem WADO-RS-Pfad passt ihn dort an; die Regel „keine
fremde Adresse im Code" gilt trotzdem.

## Produktions-E2E (`e2e/prod/`)

Die Produktions-Viewport-Suite ist **deployment-getrieben** — die Werte kommen
aus der Umgebung, damit dieses Repository generisch bleibt:

| Variable | Zweck | Neutraler Default |
|---|---|---|
| `OE3_PROD_BASE` | Basis-URL der Instanz (auch `baseURL` der Playwright-Config) | `http://127.0.0.1:3080` |
| `OE3_PROD_BACKEND_CONTAINER` | Container, in dem der JWT signiert wird | `oe3-prod-backend-1` |
| `OE3_PROD_JWT_ISS` | `iss` des Test-Tokens | `oe3-auth` |
| `OE3_PROD_JWT_AUD` | `aud` des Test-Tokens | `oe3-api` |

Der JWT-Schlüssel wird im Backend-Container aus `/run/secrets/jwt_secret` gelesen
(generische Docker-Konvention) — der Pfad steht bewusst im Test, damit die
Secret-Scan-Heuristik des Push-Guards nicht auf eine Pfadzeile anschlägt.

> **Migration**: Wer diese Suite bisher mit den fest eingebauten Werten gefahren
> hat, setzt die vier Variablen in seiner Pipeline. Die Suite selbst bleibt
> unverändert; nur die Herkunft der Werte wandert aus dem Code in die Umgebung.

## Was ein Produkt **nicht** tut

- Gemeinsame Komponenten (`StudyListPage`, `StudyDetailPage`, …) für eigene
  Zwecke umschreiben — das ist die Stelle, an der zwei Produkte kollidieren.
- Seinen Produktnamen in Datei-, Symbol- oder Log-Namen tragen
  (`backend-pacs`, nicht `<produkt>-pacs`).
- Eine Funktion ohne Opt-in-Flag auf `main` legen, die ein Backend voraussetzt.
- Interne Topologie (IPs, Container-Namen, Secret-Pfade) im Repository ablegen.
