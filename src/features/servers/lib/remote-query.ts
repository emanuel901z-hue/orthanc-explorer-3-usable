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
 * Regeln:
 *   - mehrere Wörter/Teile (durch Komma oder Leerzeichen) → ein Patientenname
 *     mit `^` zwischen den Teilen, Präfix-Suche mit `*`
 *   - reine Zahlen → Patienten-ID
 *   - Buchstaben+Zahlen oder mit Bindestrich → Zugangsnummer
 *   - Datum mit Jahr (29.08.2026, 2026-08-29, 20260829, auch als Bereich) →
 *     StudyDate
 *   - Modalität (CT, MR, …) → ModalitiesInStudy
 *   - Präfixe erzwingen ein Feld: name:, id:, acc:, date:, mod:
 */

export type RemoteQueryKind = 'name' | 'patientId' | 'accession' | 'date' | 'modality';

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
  /** Zweitdeutungen für mehrdeutige Teile: erst wenn die erste Abfrage nichts
   *  findet, wird die nächste probiert (ACC-1 kann Zugangsnummer oder ID sein). */
  alternatives: { query: Record<string, string>; chip: RemoteQueryChip }[];
};

/** Felder, die die Trefferliste anzeigt — ohne sie bleibt jede Spalte leer. */
export const REMOTE_RETURN_KEYS: Record<string, string> = {
  PatientName: '',
  PatientID: '',
  StudyDate: '',
  StudyDescription: '',
  AccessionNumber: '',
  ModalitiesInStudy: '',
  StudyInstanceUID: '',
};

const MODALITIES = new Set([
  'CT', 'MR', 'CR', 'DX', 'US', 'XA', 'PT', 'NM', 'MG', 'OT', 'RF', 'SC', 'ES', 'XC', 'SR', 'SEG',
]);

const DATE_WITH_YEAR = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // 2026-08-29
  /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // 29.08.2026
  /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/, // 29.08.26
  /^(\d{4})(\d{2})(\d{2})$/, // 20260829
];

function isoDate(token: string): string | undefined {
  let year = '';
  let month = '';
  let day = '';

  let match = DATE_WITH_YEAR[0].exec(token);
  if (match) [, year, month, day] = match;
  if (!match) {
    match = DATE_WITH_YEAR[1].exec(token);
    if (match) [, day, month, year] = match;
  }
  if (!match) {
    match = DATE_WITH_YEAR[2].exec(token);
    if (match) {
      [, day, month, year] = match;
      year = `${Number(year) > 30 ? '19' : '20'}${year}`;
    }
  }
  if (!match) {
    match = DATE_WITH_YEAR[3].exec(token);
    if (match) [, year, month, day] = match;
  }
  if (!match) return undefined;

  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${year}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** „01.01.2026-31.01.2026“ oder „20260101-20260131“ → DICOM-Bereich. */
function dateRange(token: string): string | undefined {
  const parts = token.split('-');
  if (parts.length !== 2) return undefined;
  const from = isoDate(parts[0]);
  const to = isoDate(parts[1]);
  if (!from || !to) return undefined;
  return `${from}-${to}`;
}

function isDate(token: string): string | undefined {
  return dateRange(token) ?? isoDate(token);
}

/** „29.08“ / „29.08.“ — ein Datum ohne Jahr kann DICOM nicht ausdrücken. */
function isPartialDate(token: string): boolean {
  return /^\d{1,2}\.\d{1,2}\.?$/.test(token);
}

function looksLikeModality(token: string): boolean {
  return MODALITIES.has(token.toUpperCase()) && token.length <= 3;
}

function looksLikeAccession(token: string): boolean {
  // Mit Trenner (ACC-1, E2E-COPY-1) oder Buchstaben gefolgt von Ziffern (XS1234)
  if (/^[A-Za-z0-9]+[-_][A-Za-z0-9-]+$/.test(token)) return true;
  return /^[A-Za-z]{2,}\d{2,}[A-Za-z0-9-]*$/.test(token) || /^\d{2,}[A-Za-z]{2,}$/.test(token);
}

function looksLikePatientId(token: string): boolean {
  return /^\d{3,}$/.test(token) || /^[A-Za-z]{1,4}\d{3,}$/.test(token);
}

/** Mehrdeutig: enthält Ziffern und Buchstaben — ID, Zugangsnummer oder Name? */
function isAmbiguous(token: string): boolean {
  return /[A-Za-z]/.test(token) && /\d/.test(token) && !token.includes('*') && !token.includes('?');
}

/** Erste Deutung eines freien Teils. */
function guessKind(text: string): RemoteQueryKind {
  if (looksLikeModality(text)) return 'modality';
  if (looksLikePatientId(text)) return 'patientId';
  if (looksLikeAccession(text)) return 'accession';
  return 'name';
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
  date: 'date',
  datum: 'date',
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

type BuildResult = Omit<RemoteQueryPlan, 'alternatives'> & {
  ambiguous: { text: string; alternatives: RemoteQueryKind[] }[];
};

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

  const rawTokens = input
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const raw of rawTokens) {
    const token = classify(raw);
    const forced = overrides[token.text] ?? token.kind;
    const text = token.text;

    const date = forced === 'date' ? (dateRange(text) ?? isoDate(text)) : forced ? undefined : isDate(text);
    if (date) {
      query.StudyDate = date;
      chips.push({ kind: 'date', value: date });
      continue;
    }
    if (forced === 'date') {
      ignored.push(raw);
      continue;
    }
    if (!forced && isPartialDate(text)) {
      ignored.push(raw);
      continue;
    }

    const kind: RemoteQueryKind = forced ?? guessKind(text);

    if (kind === 'name') {
      nameParts.push(text);
      if (!forced && isAmbiguous(text)) ambiguous.push({ text, alternatives: ['accession'] });
      continue;
    }
    if (kind === 'modality') {
      if (!query.ModalitiesInStudy) {
        query.ModalitiesInStudy = text.toUpperCase();
        chips.push({ kind: 'modality', value: text.toUpperCase() });
        continue;
      }
      nameParts.push(text);
      continue;
    }
    if (kind === 'patientId') {
      if (!query.PatientID) {
        query.PatientID = text;
        chips.push({ kind: 'patientId', value: text });
        if (!forced && isAmbiguous(text)) ambiguous.push({ text, alternatives: ['accession'] });
        continue;
      }
      nameParts.push(text);
      continue;
    }
    if (kind === 'accession') {
      if (!query.AccessionNumber) {
        query.AccessionNumber = text;
        chips.push({ kind: 'accession', value: text });
        if (!forced) ambiguous.push({ text, alternatives: ['patientId'] });
        continue;
      }
      nameParts.push(text);
      continue;
    }
  }

  if (nameParts.length > 0) {
    const name = personName(nameParts);
    query.PatientName = name;
    chips.unshift({ kind: 'name', value: name });
  }

  return { query, chips, ignored, ambiguous };
}

/**
 * Aus freiem Text wird eine C-FIND-Abfrage. Mehrdeutige Teile (Buchstaben und
 * Ziffern, z. B. „ACC-1“) landen zusätzlich als `alternatives` im Ergebnis:
 * die Oberfläche fragt sie erst, wenn die erste Deutung nichts findet.
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
        .map((entry) => {
          const kind = entry.alternatives[0];
          const alt = buildWithOverrides(input, { [entry.text]: kind });
          const chip = alt.chips.find((candidate) => candidate.kind === kind);
          return chip ? { query: alt.query, chip } : undefined;
        })
        .filter((entry): entry is { query: Record<string, string>; chip: RemoteQueryChip } => entry !== undefined);

  return { query: plan.query, chips: plan.chips, ignored: plan.ignored, alternatives };
}
