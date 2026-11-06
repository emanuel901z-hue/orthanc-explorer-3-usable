/**
 * DIMSE-Status eines C-MOVE/C-GET-Auftrags aus der Orthanc-Antwort ziehen.
 *
 * Orthanc (ab 1.12.10) meldet den Status pro Ziel entweder flach
 * (`DimseErrorStatus`) oder — bei mehreren Zielen/Antworten — in `Details`.
 *
 * Wichtig: 0x0000 heißt „alle Teiloperationen zugestellt“, 0xBxxx heißt
 * **teilweise** fehlgeschlagen (Warnung) — das Archiv hat einen Teil der
 * Bilder nicht wegbekommen. Alles andere ist ein Fehlschlag.
 */

export const DIMSE_SUCCESS = 0x0000;

type RetrieveResult = Record<string, unknown>;

export function extractDimseStatus(result: RetrieveResult | undefined | null): number | undefined {
  if (!result || typeof result !== 'object') return undefined;

  const details = result.Details;
  if (Array.isArray(details)) {
    for (const entry of details) {
      const status = (entry as { DimseErrorStatus?: unknown } | null)?.DimseErrorStatus;
      if (typeof status === 'number') return status;
    }
  }

  const flat = result.DimseErrorStatus;
  return typeof flat === 'number' ? flat : undefined;
}

/** Kurztext für die Oberfläche: „0x0000“ bzw. „0xC000“. */
export function formatDimseStatus(status: number): string {
  return `0x${status.toString(16).toUpperCase().padStart(4, '0')}`;
}

export type DimseSeverity = 'success' | 'warning' | 'error';

/** Wie ist der Status zu bewerten? 0xBxxx = Warnung, nicht Erfolg. */
export function dimseSeverity(status: number | undefined): DimseSeverity {
  if (status === undefined) return 'error';
  if (status === DIMSE_SUCCESS) return 'success';
  if (status >= 0xb000 && status <= 0xbfff) return 'warning';
  return 'error';
}

/**
 * Sprechender Schlüssel für häufige Status — die Oberfläche übersetzt ihn
 * (`copyJobs.dimse.<key>`). Unbekannte Codes bekommen `other`.
 */
export function dimseStatusKey(status: number | undefined): string {
  if (status === undefined) return 'unknown';
  if (status === DIMSE_SUCCESS) return 'success';
  if (status >= 0xb000 && status <= 0xbfff) return 'partial';
  switch (status) {
    case 0xa700:
      return 'outOfResources';
    case 0xa801:
      return 'unknownDestination';
    case 0xa900:
      return 'dataSetMismatch';
    case 0xc000:
      return 'unableToProcess';
    case 0xfe00:
      return 'canceled';
    default:
      return 'other';
  }
}
