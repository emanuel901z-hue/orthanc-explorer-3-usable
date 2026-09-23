# OE3 allein betreiben — Broker aus, Einstellungen vorbelegen und sperren

Diese Anleitung beantwortet die Frage: *„Kann ich das MWL-Feature abschalten und
die Einstellungen vorbelegen und schreibgeschützt machen, wenn ich nur OE3
brauche?"* — **Ja**, und zwar über **eine** Datei: `config.js`.

## Wo die Konfiguration liegt

Es gibt keine `.env` und keine `settings.json` im Frontend. OE3 liest seine
Laufzeit-Konfiguration aus einem globalen Objekt, das beim Deployment in
`dist/config.js` geschrieben wird:

```js
window.__OE3_CONFIG__ = { /* … */ };
```

| Umgebung | Datei |
|---|---|
| Entwicklung | `public/config.js` (Platzhalter) |
| Deployment (dieser Stack) | `deploy/oe3-config.js`, über `dist/config.js` gemountet |
| Orthanc-Plugin / Reverse Proxy | dieselbe Datei, vom Deployment erzeugt |

Schema: `src/config/runtime.ts` (Zod — ein unbekannter Schlüssel oder ein falscher
Typ bricht den Start mit Klartext, statt still zu wirken).

## 1. MWL-Broker abschalten

```js
window.__OE3_CONFIG__ = {
  orthancUrl: "/orthanc-proxy",
  // brokerUrl: …            ← weglassen
  features: { enableMwlBroker: false },
};
```

Beides zusammen:

* **Navigation**: der Abschnitt „MWL Broker" erscheint nur, wenn
  `enableMwlBroker` **und** `brokerUrl` gesetzt sind (`src/app/layout/AppSidebar.tsx`).
* **Routen**: `/oe3/broker/*` sind dann nicht mehr erreichbar — ein Lesezeichen
  zeigt eine Erklärung („MWL-Broker gehört nicht zu dieser Installation", mit dem
  Hinweis, was zu setzen wäre) statt einer Seite, deren jede Anfrage scheitert
  (`BrokerGate`).

## 2. Aktionen sperren (Feature-Flags)

Alles, was schreibt, hängt an Flags — ist ein Flag `false`, verschwindet die
Aktion aus der Oberfläche (kein Knopf, der in einen 403 läuft):

| Flag | Wirkung |
|---|---|
| `enableUpload` | Studien hochladen |
| `enableSend` | Senden an Modalitäten |
| `enableDelete` | Löschen |
| `enableModify` | Ändern |
| `enableAnonymize` | Anonymisieren |
| `download` | Download/Archiv |
| `editLabels` | Labels bearbeiten |
| `enableModalityConfig` | Modalitäten-Konfiguration |
| `enableWorklists` | Orthanc-Worklists-Plugin-Seite |
| `enableMwlBroker` | die Broker-Konsole (siehe oben) |

Für einen reinen **Lese-Arbeitsplatz**:

```js
features: {
  enableUpload: false, enableSend: false, enableDelete: false,
  enableModify: false, enableAnonymize: false,
  download: true, editLabels: false,
  enableModalityConfig: false, enableWorklists: false, enableMwlBroker: false,
}
```

## 3. Viewer vorbelegen und sperren

Die Viewer-Liste lag bisher **nur im Browser** (`localStorage`, Einstellungen →
Viewer) — jeder Anwender musste sie selbst einrichten, ein Admin konnte nichts
vorgeben. Jetzt gilt:

```js
viewers: [
  { id: "ohif",   url: "/ohif/viewer",          enabled: true },
  { id: "weasis", url: "weasis://",             enabled: true, type: "desktop" },
],
viewersLocked: true,
```

* **Vorbelegung**: `viewers` schlägt die Browser-Liste. Es genügt `{ id, url }` —
  Name, Beschreibung und Status bleiben aus den OE3-Standardeinträgen, ein
  unbekanntes `id` wird als eigener Eintrag geführt.
* **Sperre**: mit `viewersLocked: true` ist die Liste schreibgeschützt — der
  Bearbeiten-Knopf verschwindet, ein Hinweis nennt den Grund („Diese Liste ist
  von der Installation vorgegeben und schreibgeschützt"), und `localStorage`
  wird nicht mehr beschrieben.
* **Auch der IHE-Bildaufruf folgt der Vorgabe**: `?requestType=STUDY&studyUID=…`
  öffnet den in der Konfiguration hinterlegten Viewer, nicht den des Browsers.

## 4. Erscheinungsbild

```js
branding: { title: "Radiologie Musterstadt", logoUrl: "/logo/oe3-logo-128.png" },
frameAncestors: ["https://ris.haus.local"],
```

## 5. Was **serverseitig** vorgegeben wird

| Einstellung | Ort | Sperre |
|---|---|---|
| DICOMweb-Server | Orthanc-Seite (`/api/v1/pacs/oe3-dicomweb-config`) | serverseitig, für alle gleich |
| Broker-Konfiguration (Quellen, Ziele, Regeln, Broker-Einstellungen) | Broker-Datenbank | `rbac_mode=enforce` + `can_write=false` → die UI zeigt einen Nur-Lese-Banner und blendet Schreibknöpfe aus |
| Auth | Reverse Proxy (`authMode`, `authCheck`) | Proxy entscheidet, die UI erklärt statt 403 |

## 6. Beispiel: „nur OE3, alles gesperrt"

```js
window.__OE3_CONFIG__ = {
  orthancUrl: "/orthanc-proxy",
  authMode: "none",              // bzw. "oidc" hinter dem Proxy
  authCheck: false,
  viewerSession: false,
  // kein brokerUrl  → Broker-Navigation und -Seiten sind weg
  features: {
    enableMwlBroker: false, enableWorklists: false, enableModalityConfig: false,
    enableUpload: false, enableSend: false, enableDelete: false,
    enableModify: false, enableAnonymize: false, editLabels: false,
    download: true,
  },
  viewers: [{ id: "ohif", url: "/ohif/viewer", enabled: true }],
  viewersLocked: true,
  branding: { title: "Befundung", logoUrl: "/logo/oe3-logo-128.png" },
};
```

## 7. Prüfen, dass es greift

```bash
# Broker aus: Navigation ohne den Abschnitt, Route zeigt die Erklärung
curl -s http://127.0.0.1:18082/oe3/config.js | grep -c brokerUrl   # 0
# Tests, die genau diese Fälle festhalten
cd orthanc-explorer-3-usable
npx vitest run src/features/broker/components/BrokerGate.test.tsx \
               src/features/viewer/lib/viewer-config.test.ts
```
