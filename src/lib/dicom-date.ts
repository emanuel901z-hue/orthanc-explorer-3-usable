/**
 * DICOM-Datumsangaben für die Anzeige formatieren.
 *
 * DICOM speichert `YYYYMMDD` (`19840608`) und Zeitstempel als
 * `20261106T114657.029587` — beides ist für Menschen unlesbar. Angezeigt wird
 * in der Schreibweise der eingestellten Sprache: deutsch `08.06.1984`,
 * englisch `06/08/1984`, japanisch `1984/06/08`.
 *
 * Der gregorianische Kalender und lateinische Ziffern sind fest verdrahtet:
 * in einem Krankenhaus muss ein Geburtsdatum eindeutig und abtippbar bleiben,
 * auch wenn die Sprache einen anderen Kalender oder andere Ziffern kennt.
 */

const DATE_STYLE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  calendar: 'gregory',
  numberingSystem: 'latn',
  // DICOM-Zeitstempel sind Wandzeit ohne Zone — nicht umrechnen
  timeZone: 'UTC',
};

function localeOrFallback(locale: string | undefined): string {
  return locale && locale.length > 0 ? locale : 'de';
}

/** `19840608` → `08.06.1984` (je nach Sprache). Unbekanntes bleibt stehen. */
export function formatDicomDate(value: string | undefined, locale?: string): string {
  if (!value || !/^\d{8}$/.test(value)) return value ?? '';
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return value;

  try {
    return new Intl.DateTimeFormat(localeOrFallback(locale), DATE_STYLE).format(
      new Date(Date.UTC(year, month - 1, day)),
    );
  } catch {
    return value;
  }
}

/**
 * `20261106T114657.029587` → `06.11.2026, 11:46` (je nach Sprache).
 * Ein reines Datum wird ebenfalls angenommen.
 */
export function formatDicomDateTime(value: string | undefined, locale?: string): string {
  if (!value) return '—';
  const match = /^(\d{8})T(\d{2})(\d{2})/.exec(value);
  if (!match) return formatDicomDate(value, locale);

  const [, date, hour, minute] = match;
  const formattedDate = formatDicomDate(date, locale);
  if (formattedDate === date) return value;

  try {
    const time = new Intl.DateTimeFormat(localeOrFallback(locale), {
      hour: '2-digit',
      minute: '2-digit',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2000, 0, 1, Number(hour), Number(minute))));
    return `${formattedDate}, ${time}`;
  } catch {
    return `${formattedDate}, ${hour}:${minute}`;
  }
}
