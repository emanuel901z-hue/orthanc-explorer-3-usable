import { describe, it, expect } from 'vitest';
import { formatDicomDate, formatDicomDateTime } from './dicom-date';

describe('formatDicomDate — DICOM-Datum in der Sprache des Benutzers', () => {
  it('zeigt im deutschen Raum dd.mm.yyyy', () => {
    expect(formatDicomDate('19840608', 'de')).toBe('08.06.1984');
  });

  it('folgt der jeweiligen Lokalität', () => {
    expect(formatDicomDate('19840608', 'en')).toBe('06/08/1984');
    expect(formatDicomDate('19840608', 'fr')).toBe('08/06/1984');
    expect(formatDicomDate('19840608', 'ja')).toBe('1984/06/08');
    expect(formatDicomDate('19840608', 'zh')).toBe('1984/06/08');
    expect(formatDicomDate('19840608', 'ru')).toBe('08.06.1984');
    expect(formatDicomDate('19840608', 'tr')).toBe('08.06.1984');
  });

  it('bleibt bei lateinischen Ziffern, auch im arabischen Raum', () => {
    const formatted = formatDicomDate('19840608', 'ar');
    expect(formatted.replace(/\u200f/g, '')).toBe('08/06/1984');
  });

  it('nimmt deutsche Schreibweise als Standard, wenn keine Sprache kommt', () => {
    expect(formatDicomDate('19840608')).toBe('08.06.1984');
    expect(formatDicomDate('19840608', '')).toBe('08.06.1984');
  });

  it('verschiebt das Datum nicht über Zeitzonen', () => {
    // 1. Januar darf nicht zum 31. Dezember werden
    expect(formatDicomDate('20260101', 'de')).toBe('01.01.2026');
    expect(formatDicomDate('20261231', 'de')).toBe('31.12.2026');
  });

  it('lässt Unbekanntes stehen, statt zu raten', () => {
    expect(formatDicomDate('—', 'de')).toBe('—');
    expect(formatDicomDate('', 'de')).toBe('');
    expect(formatDicomDate('2026', 'de')).toBe('2026');
    expect(formatDicomDate('20261301', 'de')).toBe('20261301');
  });
});

describe('formatDicomDateTime — Zeitstempel der Aufträge', () => {
  it('zeigt Datum und Uhrzeit in der Sprache', () => {
    expect(formatDicomDateTime('20261106T114657.029587', 'de')).toBe('06.11.2026, 11:46');
    expect(formatDicomDateTime('20261106T114657.029587', 'ja')).toBe('2026/11/06, 11:46');
  });

  it('rechnet die Uhrzeit nicht in die lokale Zone um', () => {
    // DICOM-Zeitstempel sind Wandzeit — 23:59 darf nicht zu 01:59 werden
    expect(formatDicomDateTime('20261106T235900', 'de')).toBe('06.11.2026, 23:59');
  });

  it('nimmt auch ein reines Datum', () => {
    expect(formatDicomDateTime('19840608', 'de')).toBe('08.06.1984');
  });

  it('meldet fehlende Werte als Strich', () => {
    expect(formatDicomDateTime(undefined, 'de')).toBe('—');
    expect(formatDicomDateTime('', 'de')).toBe('—');
  });
});
