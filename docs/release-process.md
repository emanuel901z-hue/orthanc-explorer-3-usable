# Release-Prozess (OE3-Fork)

Dieser Fork ist die **gemeinsame OE3-Basis zweier Produkte** (öffentlicher
MWL-Broker-Workspace + internes PACS-Projekt mit eigenem privatem Stack). Beide
pushen nach `main`, beide konsumieren dieselben Komponenten. Damit aus geteiltem
Code kein Drift wird, wird `main` **getaggt** und von den Konsumenten über den
**Tag** gepinnt — nie über einen Branch-Head.

Die drei Regeln (Schichtung, Releases, Gate) stehen in
[`CLAUDE.md`](../CLAUDE.md#releases--governance). Dieses Dokument ist die
Schritt-für-Schritt-Liste zum Schneiden einer Release.

## Warum überhaupt taggen

Ein Branch-Head bewegt sich unter dem Konsumenten weg. Genau so stand der
Broker-Workspace elf Commits hinter `main`, ohne dass es jemandem auffiel — die
gepinnte Submodule-Ref war ein roher Commit, kein Release. Ein Tag ist ein
stabiler, bewusst gewählter Adoptionspunkt.

## Checkliste

### 0. Vorbedingungen

- [ ] Arbeitsbaum sauber (`git status`), auf `main`
- [ ] `git pull --ff-only` — `main` ist aktuell
- [ ] Kein unfertiger Sprint auf `main` (was getaggt wird, ist ausgeliefert)

### 1. Qualitätsgates (alle grün, sonst abbrechen)

```bash
npx tsc --noEmit -p tsconfig.app.json     # 0 Fehler
npm run test                              # alle Tests grün
npm run lint                              # 0 Fehler
npm run i18n:check                        # 100 % in allen Sprachen
npm run build                             # 0 Fehler
```

Die tatsächliche Testzahl aus `npm run test` notieren — sie kommt in Schritt 2.

### 2. Release-Inhalt nachziehen

- [ ] `docs/fork-changelog.md`: neuer Abschnitt ganz oben
      (`## vX.Y.Z — <Titel> (<Datum>)`), je Änderung knapp „was" + „warum"
- [ ] `README.md`: Test-Badge (Zeile ~6), Tech-Stack-Tabelle und der
      „Unit Tests"-Absatz auf die **echte** Zahl aus Schritt 1
- [ ] `CLAUDE.md`: Testzahlen in „Testing" und in der CI-Tabelle
- [ ] Version in `package.json` (`npm version --no-git-tag-version X.Y.Z` oder
      von Hand)

> Die Testzahlen driften erfahrungsgemäß (zuletzt standen 191/606/673 gegen
> reale 696 im Repo). Deshalb sind sie Teil der Checkliste, nicht optional.

### 3. Committen und taggen

```bash
git add -A
git commit -m "chore(release): vX.Y.Z — <was in dieser Release steckt>"

git tag -a vX.Y.Z -m "vX.Y.Z — <Kurzbeschreibung>

<Stichpunkte: was neu ist, welche Gates grün sind>"
```

### 4. Pushen (nur über den Guard)

Der öffentliche Push läuft **aus dem Broker-Workspace** über den gehärteten
Guard (Blacklist + Secret-Scan, verweigert Upstream-Remotes):

```bash
cd ../orthanc-dicommwl-broker
./pre-push-fork.sh --dry-run     # erst prüfen
./pre-push-fork.sh               # Branch + Tag pushen
```

### 5. Konsumenten nachziehen

- [ ] Broker-Workspace: Submodule auf den neuen Tag heben, Pin committen

```bash
cd orthanc-explorer-3-usable && git checkout vX.Y.Z
cd .. && git add orthanc-explorer-3-usable
git commit -m "chore: submodule pin — vX.Y.Z (<kurz>)"
```

- [ ] Stack gegen den neuen Pin verifizieren (`docker compose up -d --build oe3`,
      dann `node orthanc-explorer-3-usable/e2e/stack/verify-ui.cjs`)
- [ ] Internes Projekt informieren, dass ein Tag bereitsteht (es entscheidet
      selbst, wann es nachzieht — das ist der Sinn der Entkopplung)

## Wenn eine Release kaputt ist

- **Vor dem Push**: Tag lokal löschen (`git tag -d vX.Y.Z`), Fix committen, neu taggen.
- **Nach dem Push**: **nicht** den Tag verschieben (Konsumenten haben ihn schon).
  Stattdessen sofort `vX.Y.(Z+1)` mit dem Fix schneiden und die Konsumenten
  informieren. Ein verschobener Tag ist für jeden, der bereits gepinnt hat, unsichtbar.

## Was nicht in eine Release gehört

- Unfertige Sprints auf `main`.
- Projekt-spezifische Integrationen ohne Opt-in-Flag (siehe Schichtungsregel) —
  sie würden im Stack des anderen Produkts als tote Anfrage auftauchen.
