/**
 * DIMSE-Status eines C-MOVE/C-GET-Auftrags aus der Orthanc-Antwort ziehen.
 *
 * Orthanc (ab 1.12.10) meldet den Status pro Ziel entweder flach
 * (`DimseErrorStatus`) oder — bei mehreren Zielen/Antworten — in `Details`.
 * 0x0000 heißt „alles zugestellt“, alles andere ist ein Fehlschlag des Ziels.
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
