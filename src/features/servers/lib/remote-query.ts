/**
 * Eine Suchzeile für das entfernte Archiv: aus freiem Text wird eine
 * DICOM-C-FIND-Abfrage.
 *
 * Die Studienliste filtert lokal — dort darf „29.08“ weich passen. Gegen ein
 * fremdes Archiv geht nur, was DICOM hergibt: ein Präfix mit `*`, ein
 * Datumsbereich, ein exakter Wert je Attribut. Deshalb übersetzt diese Funktion
 * die Eingabe in eine Abfrage und liefert gleich die „Chips“, die der
 * Oberfläche zeigen, was sie daraus gemacht hat — damit niemand raten muss,
 * warum nichts kommt.
 *
 * Der Alltag in der Praxis ist `Nachname,Vorname,Geburtsdatum` — oder direkt
 * die Patienten-ID, oder die Zugangsnummer. Geburtsdaten kommen in vielen
 * Schreibweisen: `03.06.2026`, `030626`, `03062026`, `3623` (3.6.23). Zahlen
 * sind deshalb mehrdeutig; die wahrscheinlichste Deutung wird gesucht und die
 * übrigen als `alternatives` mitgeliefert, damit die Oberfläche sie probieren
 * kann, wenn nichts kommt.
 *
 * Regeln:
 *   - Komma trennt Angaben (`Muster,Erika,030626`), Leerzeichen trennt Teile
 *     derselben Angabe (`Muster Erika`)
 *   - Wörter → Patientenname, Teile mit `^` verbunden, Präfix-Suche mit `*`
 *   - Datum → **Geburtsdatum** (der Normalfall), mit `datum:`/`date:` wird es
 *     zum Studiendatum
 *   - reine Zahlen → Geburtsdatum (wenn gültig), sonst Patienten-ID
 *   - Buchstaben+Zahlen → Zugangsnummer
 *   - Modalität (CT, MR, …) → ModalitiesInStudy
 *   - Präfixe erzwingen ein Feld: name: id: acc: geb: datum: mod:
 */

export type RemoteQueryKind =
  | 'name'
  | 'patientId'
  | 'accession'
  | 'birthDate'
  | 'studyDate'
  | 'studyDescription'
  | 'studyInstanceUid'
  | 'modality';

export type RemoteQueryChip = {
  kind: RemoteQueryKind;
  /** Was in der Abfrage steht (bereits DICOM-tauglich). */
  value: string;
};

export type RemoteQueryPlan = {
  query: Record<string, string>;
  chips: RemoteQueryChip[];
  /** Teile, die nicht verwendet werden konnten (z. B. Datum ohne Jahr). */
  ignored: string[];
  /** Weitere Deutungen für mehrdeutige Teile, in der Reihenfolge zum Probieren. */
  alternatives: { query: Record<string, string>; chip: RemoteQueryChip }[];
};

/** Felder, die die Trefferliste anzeigt — ohne sie bleibt jede Spalte leer. */
export const REMOTE_RETURN_KEYS: Record<string, string> = {
  PatientName: '',
  PatientID: '',
  PatientBirthDate: '',
  StudyDate: '',
  StudyDescription: '',
  AccessionNumber: '',
  ModalitiesInStudy: '',
  StudyInstanceUID: '',
};

const MODALITIES = new Set([
  'CT', 'MR', 'CR', 'DX', 'US', 'XA', 'PT', 'NM', 'MG', 'OT', 'RF', 'SC', 'ES', 'XC', 'SR', 'SEG',
]);

/** Zweistellige Jahre: alles bis zum laufenden Jahr ist 20xx, der Rest 19xx. */
function expandYear(yy: number): number {
  const current = new Date().getFullYear() % 100;
  return yy <= current ? 2000 + yy : 1900 + yy;
}

function isoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

/**
 * Erkennt eine Datumsangabe und gibt sie als DICOM-Datum (YYYYMMDD) zurück.
 * Unterstützt `03.06.2026`, `03.06.26`, `2026-06-03`, `03062026`, `030626`,
 * `3623` (3.6.23) und `19920502`.
 */
export function parseDateToken(token: string): string | undefined {
  // mit Trennern: 03.06.2026, 3.6.26, 2026-06-03, 03/06/2026
  const dotted = /^(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,4})$/.exec(token);
  if (dotted) {
    const [, first, second, third] = dotted;
    if (first.length === 4) return isoDate(Number(first), Number(second), Number(third));
    const year = third.length <= 2 ? expandYear(Number(third)) : Number(third);
    return isoDate(year, Number(second), Number(first));
  }

  if (!/^\d{4,8}$/.test(token)) return undefined;

  // 8 Ziffern: 19920502 (yyyyMMdd) oder 02051992 (ddMMyyyy)
  if (token.length === 8) {
    const head = Number(token.slice(0, 4));
    if (head >= 1900 && head <= 2099) {
      return isoDate(head, Number(token.slice(4, 6)), Number(token.slice(6, 8)));
    }
    return isoDate(
      Number(token.slice(4, 8)),
      Number(token.slice(2, 4)),
      Number(token.slice(0, 2)),
    );
  }

  // 6 Ziffern: 030626 → 03.06.2026
  if (token.length === 6) {
    return isoDate(
      expandYear(Number(token.slice(4, 6))),
      Number(token.slice(2, 4)),
      Number(token.slice(0, 2)),
    );
  }

  // 4 Ziffern: 3623 → 3.6.23 (Tag und Monat ein- oder zweistellig)
  if (token.length === 4) {
    for (const [dayLength, monthLength] of [[1, 1], [2, 1], [1, 2]] as const) {
      const day = Number(token.slice(0, dayLength));
      const month = Number(token.slice(dayLength, dayLength + monthLength));
      const yearDigits = token.slice(dayLength + monthLength);
      if (yearDigits.length !== 2) continue;
      const result = isoDate(expandYear(Number(yearDigits)), month, day);
      if (result) return result;
    }
  }

  return undefined;
}

/** „01.01.2026-31.01.2026“ oder „20260101-20260131“ → DICOM-Bereich. */
function dateRange(token: string): string | undefined {
  const parts = token.split('-');
  if (parts.length !== 2) return undefined;
  const from = parseDateToken(parts[0]);
  const to = parseDateToken(parts[1]);
  if (!from || !to) return undefined;
  return `${from}-${to}`;
}

/** „29.08“ / „29.08.“ — ein Datum ohne Jahr kann DICOM nicht ausdrücken. */
function isPartialDate(token: string): boolean {
  return /^\d{1,2}\.\d{1,2}\.?$/.test(token);
}

function looksLikeModality(token: string): boolean {
  return MODALITIES.has(token.toUpperCase()) && token.length <= 3;
}

function looksLikeAccession(token: string): boolean {
  if (/^[A-Za-z0-9]+[-_][A-Za-z0-9-]+$/.test(token)) return true;
  return /^[A-Za-z]{2,}\d{2,}[A-Za-z0-9-]*$/.test(token) || /^\d{2,}[A-Za-z]{2,}$/.test(token);
}

function looksLikePatientId(token: string): boolean {
  return /^\d{3,}$/.test(token) || /^[A-Za-z]{1,4}\d{3,}$/.test(token);
}

function isAmbiguous(token: string): boolean {
  return /[A-Za-z]/.test(token) && /\d/.test(token) && !token.includes('*') && !token.includes('?');
}

/**
 * Alle plausiblen Deutungen eines Teils, wahrscheinlichste zuerst.
 * Zahlen sind der schwierige Fall: `030626` kann Geburtsdatum oder ID sein,
 * `3623` genauso.
 */
/** DICOM-UID: mindestens vier Zahlenblöcke, z. B. 1.2.276.0.7230010.3.1.2.1234 */
function looksLikeStudyInstanceUid(text: string): boolean {
  return /^\d+(\.\d+){3,}$/.test(text);
}

export function candidatesFor(text: string): RemoteQueryKind[] {
  if (looksLikeStudyInstanceUid(text)) return ['studyInstanceUid'];
  if (looksLikeModality(text)) return ['modality'];
  if (parseDateToken(text) || dateRange(text)) return ['birthDate', 'patientId', 'accession'];
  if (looksLikePatientId(text)) return ['patientId', 'accession'];
  if (looksLikeAccession(text)) return ['accession', 'patientId'];
  if (isAmbiguous(text)) return ['name', 'accession'];
  return ['name'];
}

/** DICOM-Personennamen: Teile mit `^`, Präfix-Suche mit `*`. */
function personName(parts: string[]): string {
  const cleaned = parts
    .map((part) => part.replace(/\s+/g, '').replace(/,+$/, ''))
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  const joined = cleaned.join('^').toUpperCase();
  return /[*?]$/.test(joined) ? joined : `${joined}*`;
}

type Token = { text: string; kind?: RemoteQueryKind };

const PREFIXES: Record<string, RemoteQueryKind> = {
  name: 'name',
  patient: 'name',
  id: 'patientId',
  pid: 'patientId',
  acc: 'accession',
  accession: 'accession',
  geb: 'birthDate',
  birth: 'birthDate',
  gebdat: 'birthDate',
  datum: 'studyDate',
  date: 'studyDate',
  studydate: 'studyDate',
  desc: 'studyDescription',
  beschreibung: 'studyDescription',
  text: 'studyDescription',
  uid: 'studyInstanceUid',
  siuid: 'studyInstanceUid',
  studyinstanceuid: 'studyInstanceUid',
  mod: 'modality',
  modality: 'modality',
};

function classify(raw: string): Token {
  const prefix = /^([A-Za-zäöü]+):(.*)$/.exec(raw);
  if (prefix) {
    const kind = PREFIXES[prefix[1].toLowerCase()];
    const rest = prefix[2].trim();
    if (kind && rest) return { text: rest, kind };
  }
  return { text: raw };
}

/**
 * Die Reihenfolge nach dem Komma — so arbeiten die Mitarbeiter:
 * `Müller,Paul,030847,MRT,07.08.2026` heißt Nachname, Vorname, Geburtsdatum,
 * Beschreibung, Studiendatum. Wer etwas anderes meint, schreibt ein Präfix
 * davor (`acc:`, `mod:`, …).
 */
export const POSITIONAL_FIELDS: RemoteQueryKind[] = [
  'name',
  'name',
  'birthDate',
  'studyDescription',
  'studyDate',
  'accession',
  'modality',
  'studyInstanceUid',
];

/** Deutsche Kurzformen auf DICOM-Modalitätscodes. */
const MODALITY_ALIASES: Record<string, string> = {
  MRT: 'MR',
  SONO: 'US',
  MAMMO: 'MG',
  SZINTI: 'NM',
  PET: 'PT',
};

export function normalizeModality(text: string): string {
  const upper = text.toUpperCase();
  return MODALITY_ALIASES[upper] ?? upper;
}

/** Passt der Inhalt in das Feld, das an dieser Position steht? */
function fitsSlot(kind: RemoteQueryKind, text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  switch (kind) {
    case 'name':
      // Namen ohne Ziffern und ohne bekannte Modalitätskürzel
      return !/\d/.test(clean) && !looksLikeModality(clean);
    case 'birthDate':
    case 'studyDate':
      return Boolean(parseDateToken(clean) || dateRange(clean));
    case 'studyDescription':
      return /[A-Za-zÄÖÜäöüß]/.test(clean);
    case 'accession':
      return true;
    case 'modality':
      return looksLikeModality(clean) || Object.prototype.hasOwnProperty.call(MODALITY_ALIASES, clean.toUpperCase());
    case 'studyInstanceUid':
      return looksLikeStudyInstanceUid(clean);
    default:
      return false;
  }
}

type BuildResult = Omit<RemoteQueryPlan, 'alternatives'> & {
  ambiguous: { text: string; alternatives: RemoteQueryKind[] }[];
};

function assign(
  query: Record<string, string>,
  chips: RemoteQueryChip[],
  kind: RemoteQueryKind,
  text: string,
): boolean {
  if (kind === 'birthDate') {
    const value = dateRange(text) ?? parseDateToken(text);
    if (!value || query.PatientBirthDate) return false;
    query.PatientBirthDate = value;
    chips.push({ kind, value });
    return true;
  }
  if (kind === 'studyDate') {
    const value = dateRange(text) ?? parseDateToken(text);
    if (!value || query.StudyDate) return false;
    query.StudyDate = value;
    chips.push({ kind, value });
    return true;
  }
  if (kind === 'patientId') {
    if (query.PatientID) return false;
    query.PatientID = text;
    chips.push({ kind, value: text });
    return true;
  }
  if (kind === 'accession') {
    if (query.AccessionNumber) return false;
    query.AccessionNumber = text;
    chips.push({ kind, value: text });
    return true;
  }
  if (kind === 'modality') {
    if (query.ModalitiesInStudy) return false;
    const value = normalizeModality(text);
    query.ModalitiesInStudy = value;
    chips.push({ kind, value });
    return true;
  }
  if (kind === 'studyDescription') {
    if (query.StudyDescription) return false;
    // Freitext: „enthält“ ist das, was Mitarbeiter erwarten (Orthanc kann das).
    // „beginnt mit“ kommt als Zweitdeutung, falls ein Archiv führende
    // Platzhalter nicht mag.
    const value = `*${text.toUpperCase()}*`;
    query.StudyDescription = value;
    chips.push({ kind, value });
    return true;
  }
  if (kind === 'studyInstanceUid') {
    if (query.StudyInstanceUID) return false;
    query.StudyInstanceUID = text;
    chips.push({ kind, value: text });
    return true;
  }
  return false;
}

function buildWithOverrides(
  input: string,
  overrides: Record<string, RemoteQueryKind>,
): BuildResult {
  const chips: RemoteQueryChip[] = [];
  const ignored: string[] = [];
  const ambiguous: { text: string; alternatives: RemoteQueryKind[] }[] = [];
  const nameParts: string[] = [];
  // Rückgabe-Felder zuerst, damit die Trefferliste alle Spalten füllen kann;
  // die Suchwerte überschreiben sie anschließend (C-FIND: Attribut mit Wert =
  // Suchkriterium, Attribut ohne Wert = Rückgabefeld).
  const query: Record<string, string> = { ...REMOTE_RETURN_KEYS };

  // Komma trennt Angaben (Name, Vorname, Geburtsdatum), Leerzeichen trennt
  // Teile derselben Angabe. Leere Angaben bleiben stehen: sie halten ihre
  // Position frei („müller,paul,030847,,07.08.2026“ überspringt die
  // Beschreibung).
  const segments = input.split(',').map((segment) => segment.trim());
  const filled = segments.filter(Boolean);
  // Entweder rein positional („Müller,Paul,030847“) oder mit Präfixen
  // („Muster,desc:MRT“) — gemischt wäre die Position nicht mehr eindeutig.
  const positionalMode = filled.length >= 2 && filled.every((segment) => !/^[A-Za-zäöü]+:\s*.+$/.test(segment));

  segments.forEach((segment, index) => {
    // Leeres Feld: Position freihalten, nichts zuordnen
    if (!segment) return;

    // Ein Präfix gilt für die ganze Angabe — „desc:CT Thorax“ ist eine
    // Beschreibung, nicht das Feld „desc“ mit dem Wert „CT“.
    const segmentPrefix = /^([A-Za-zäöü]+):\s*(.+)$/.exec(segment);
    if (segmentPrefix) {
      const kind = PREFIXES[segmentPrefix[1].toLowerCase()];
      const value = segmentPrefix[2].trim();
      if (kind && value) {
        if (kind === 'name') {
          nameParts.push(...value.split(/\s+/).filter(Boolean));
          return;
        }
        if (!assign(query, chips, kind, value) && (kind === 'birthDate' || kind === 'studyDate')) {
          ignored.push(segment);
        }
        return;
      }
    }

    // Position nach dem Komma bestimmt das Feld — solange der Inhalt passt.
    // Ab zwei Angaben, weil ein einzelner Wert (ID, Datum, UID) über seinen
    // Inhalt besser erkannt wird.
    const positional = positionalMode ? POSITIONAL_FIELDS[index] : undefined;
    if (positional && fitsSlot(positional, segment)) {
      if (positional === 'name') {
        nameParts.push(...segment.split(/\s+/).filter(Boolean));
        return;
      }
      assign(query, chips, positional, segment.trim());
      return;
    }

    for (const raw of segment.split(/\s+/).filter(Boolean)) {
      const token = classify(raw);
      const text = token.text;
      const forced = overrides[text] ?? token.kind;

      if (forced) {
        if (forced === 'name') {
          nameParts.push(text);
          continue;
        }
        if (!assign(query, chips, forced, text)) {
          if (forced === 'birthDate' || forced === 'studyDate') ignored.push(raw);
        }
        continue;
      }

      if (isPartialDate(text)) {
        ignored.push(raw);
        continue;
      }

      const candidates = candidatesFor(text);
      const primary = candidates[0];
      if (primary === 'name') {
        nameParts.push(text);
      } else if (!assign(query, chips, primary, text)) {
        nameParts.push(text);
      }
      if (candidates.length > 1) {
        ambiguous.push({ text, alternatives: candidates.slice(1) });
      }
    }
  });

  if (nameParts.length > 0) {
    const name = personName(nameParts);
    query.PatientName = name;
    chips.unshift({ kind: 'name', value: name });
  }

  return { query, chips, ignored, ambiguous };
}

/**
 * Aus freiem Text wird eine C-FIND-Abfrage. Mehrdeutige Teile landen zusätzlich
 * als `alternatives` im Ergebnis — die Oberfläche probiert sie erst, wenn die
 * erste Deutung nichts findet.
 */
export function buildRemoteQuery(
  input: string,
  overrides: Record<string, RemoteQueryKind> = {},
): RemoteQueryPlan {
  const plan = buildWithOverrides(input, overrides);
  const alternatives =
    Object.keys(overrides).length > 0
      ? []
      : plan.ambiguous
        .flatMap((entry) =>
          entry.alternatives.map((kind) => {
            const alt = buildWithOverrides(input, { [entry.text]: kind });
            const chip = alt.chips.find((candidate) => candidate.kind === kind);
            return chip ? { query: alt.query, chip } : undefined;
          }),
        )
        .filter((entry): entry is { query: Record<string, string>; chip: RemoteQueryChip } => entry !== undefined)
        // doppelte Varianten nicht mehrfach abfragen
        .filter((entry, index, all) => all.findIndex((other) => other.chip.kind === entry.chip.kind) === index);

  // Beschreibungen sind Freitext: „enthält“ zuerst, „beginnt mit“ als
  // Zweitversuch für Archive ohne führende Platzhalter.
  const description = plan.query.StudyDescription;
  if (Object.keys(overrides).length === 0 && description.startsWith('*') && description.endsWith('*')) {
    const prefixValue = description.slice(1);
    alternatives.unshift({
      query: { ...plan.query, StudyDescription: prefixValue },
      chip: { kind: 'studyDescription', value: prefixValue },
    });
  }

  return { query: plan.query, chips: plan.chips, ignored: plan.ignored, alternatives };
}
