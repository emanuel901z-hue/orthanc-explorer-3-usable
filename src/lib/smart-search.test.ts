import { describe, it, expect } from 'vitest';
import { smartSearch } from './smart-search';

describe('smartSearch', () => {
  describe('multi-token AND matching', () => {
    it('requires every token to match at least one field', () => {
      expect(smartSearch('Mueller CT', ['Mueller', 'CT'])).toBe(true);
      expect(smartSearch('Mueller MR', ['Mueller', 'CT'])).toBe(false);
    });

    it('returns true for an empty query', () => {
      expect(smartSearch('', ['anything'])).toBe(true);
      expect(smartSearch('   ', ['anything'])).toBe(true);
    });

    it('splits on whitespace and commas', () => {
      expect(smartSearch('Mueller, CT', ['Mueller', 'CT'])).toBe(true);
      expect(smartSearch('Mueller CT, 2908', ['Mueller', 'CT', '2026-08-29'])).toBe(true);
    });
  });

  describe('umlaut tolerance', () => {
    it('matches "ü" against "ue" and vice versa', () => {
      expect(smartSearch('Müller', ['Mueller'])).toBe(true);
      expect(smartSearch('Mueller', ['Müller'])).toBe(true);
    });

    it('matches "ä"/"ae", "ö"/"oe", "ß"/"ss"', () => {
      expect(smartSearch('Straße', ['Strasse'])).toBe(true);
      expect(smartSearch('Schäfer', ['Schaefer'])).toBe(true);
      expect(smartSearch('Größe', ['Groesse'])).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(smartSearch('MUELLER', ['müller'])).toBe(true);
      expect(smartSearch('müller', ['MUELLER'])).toBe(true);
    });
  });

  describe('hyphen removal', () => {
    it('treats "Smith-John" and "SmithJohn" as equivalent', () => {
      expect(smartSearch('Smith-John', ['SmithJohn'])).toBe(true);
      expect(smartSearch('SmithJohn', ['Smith-John'])).toBe(true);
    });
  });

  describe('date matching', () => {
    it('matches ISO date "2026-08-29" with "2908"', () => {
      expect(smartSearch('2908', ['2026-08-29'])).toBe(true);
    });

    it('matches ISO date with full "29082026"', () => {
      expect(smartSearch('29082026', ['2026-08-29'])).toBe(true);
    });

    it('matches ISO date with "29.08.2026"', () => {
      expect(smartSearch('29.08.2026', ['2026-08-29'])).toBe(true);
    });

    it('matches ISO date with "29.8.26"', () => {
      expect(smartSearch('29.8.26', ['2026-08-29'])).toBe(true);
    });

    it('matches locale date "29.08.2026" with ISO field', () => {
      expect(smartSearch('29.08.2026', ['2026-08-29'])).toBe(true);
    });

    it('matches locale date "29.8.2026" with "2908"', () => {
      expect(smartSearch('2908', ['29.8.2026'])).toBe(true);
    });

    // Regression test for the 4-digit parser bug: previously, "2908" was
    // parsed as day=2, month=9 (single digits) instead of day=29, month=08.
    // The fix uses tokenDigits.slice(0,2) / slice(2,4).
    it('parses 4-digit token "2908" as dd=29, mm=08 (not dd=2, mm=9)', () => {
      // "2908" must match a 29.08.* date, and must NOT match a 02.09.* date.
      expect(smartSearch('2908', ['2026-08-29'])).toBe(true);
      expect(smartSearch('2908', ['2026-09-02'])).toBe(false);
    });

    it('parses 4-digit token "3112" as dd=31, mm=12', () => {
      expect(smartSearch('3112', ['2026-12-31'])).toBe(true);
      expect(smartSearch('3112', ['2026-12-03'])).toBe(false);
    });
  });

  describe('combined name + date + modality', () => {
    it('matches "Müller, CT, 29.08" against a study with those fields', () => {
      const fields = ['Müller', 'CT', '2026-08-29'];
      expect(smartSearch('Müller, CT, 29.08', fields)).toBe(true);
    });

    it('matches "Muell ct 2908" with umlaut + date normalization', () => {
      const fields = ['Müller', 'CT', '2026-08-29'];
      expect(smartSearch('Muell ct 2908', fields)).toBe(true);
    });
  });

  describe('null / undefined / Date field handling', () => {
    it('treats null and undefined fields as empty strings', () => {
      expect(smartSearch('foo', [null, undefined, 'foo'])).toBe(true);
      expect(smartSearch('foo', [null, undefined])).toBe(false);
    });

    it('matches Date objects via toISOString', () => {
      const d = new Date('2026-08-29T10:00:00Z');
      expect(smartSearch('2026-08-29', [d])).toBe(true);
      expect(smartSearch('2908', [d])).toBe(true);
    });
  });
});
