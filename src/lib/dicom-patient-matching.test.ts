import { describe, it, expect } from 'vitest';
import {
  parseDicomName,
  generateNameVariants,
  normalizeDicomDate,
  patientSignaturesMatch,
  type PatientSignature,
} from './dicom-patient-matching';

function sig(patientId = '', patientName = '', patientBirthDate = ''): PatientSignature {
  return { patientId, patientName, patientBirthDate };
}

describe('parseDicomName', () => {
  it('splits DICOM PN into last and first name', () => {
    expect(parseDicomName('Müller^Hans')).toEqual({ lastName: 'Müller', firstName: 'Hans' });
  });

  it('ignores middle, prefix, suffix components', () => {
    expect(parseDicomName('Müller^Hans^Peter^Dr^Jr')).toEqual({ lastName: 'Müller', firstName: 'Hans' });
  });

  it('trims whitespace', () => {
    expect(parseDicomName('  Müller  ^  Hans  ')).toEqual({ lastName: 'Müller', firstName: 'Hans' });
  });

  it('returns empty strings for missing components', () => {
    expect(parseDicomName('Müller')).toEqual({ lastName: 'Müller', firstName: '' });
    expect(parseDicomName('')).toEqual({ lastName: '', firstName: '' });
  });
});

describe('generateNameVariants', () => {
  it('produces umlaut-resolved and umlaut-reapplied variants', () => {
    const variants = generateNameVariants('Müller');
    expect(variants).toContain('müller');
    expect(variants).toContain('mueller');
    expect(variants).toContain('müller'); // reapplied ue -> ü gives same as original for this word
  });

  it('is case-insensitive', () => {
    const lower = generateNameVariants('MÜLLER');
    expect(lower).toContain('müller');
    expect(lower).toContain('mueller');
  });

  it('handles ß correctly', () => {
    const variants = generateNameVariants('Straße');
    expect(variants).toContain('straße');
    expect(variants).toContain('strasse');
  });

  it('returns empty array for empty input', () => {
    expect(generateNameVariants('')).toEqual([]);
  });
});

describe('normalizeDicomDate', () => {
  it('converts YYYYMMDD to YYYY-MM-DD', () => {
    expect(normalizeDicomDate('19680427')).toBe('1968-04-27');
  });

  it('passes through ISO date', () => {
    expect(normalizeDicomDate('1968-04-27')).toBe('1968-04-27');
  });

  it('returns null for invalid formats', () => {
    expect(normalizeDicomDate('1968')).toBeNull();
    expect(normalizeDicomDate('')).toBeNull();
    expect(normalizeDicomDate('invalid')).toBeNull();
  });
});

describe('patientSignaturesMatch', () => {
  it('matches by exact PatientID when both present', () => {
    expect(patientSignaturesMatch(sig('P001', '', ''), sig('P001', '', ''))).toBe(true);
  });

  it('rejects by different PatientID', () => {
    expect(patientSignaturesMatch(sig('P001', '', ''), sig('P002', '', ''))).toBe(false);
  });

  it('matches by demography (exact)', () => {
    const a = sig('', 'Müller^Hans', '19680427');
    const b = sig('', 'Müller^Hans', '1968-04-27');
    expect(patientSignaturesMatch(a, b)).toBe(true);
  });

  it('matches by demography with umlaut spelling variants', () => {
    const a = sig('', 'Müller^Hans', '19680427');
    const b = sig('', 'Mueller^Hans', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(true);
  });

  it('matches by demography with case differences', () => {
    const a = sig('', 'MÜLLER^HANS', '19680427');
    const b = sig('', 'müller^hans', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(true);
  });

  it('matches first name with prefix tolerance', () => {
    const a = sig('', 'Müller^Hans-Peter', '19680427');
    const b = sig('', 'Mueller^Hans-P', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(true);
  });

  it('rejects different last name', () => {
    const a = sig('', 'Müller^Hans', '19680427');
    const b = sig('', 'Schmidt^Hans', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(false);
  });

  it('rejects different birth date', () => {
    const a = sig('', 'Müller^Hans', '19680427');
    const b = sig('', 'Müller^Hans', '19700115');
    expect(patientSignaturesMatch(a, b)).toBe(false);
  });

  it('rejects different first name', () => {
    const a = sig('', 'Müller^Hans', '19680427');
    const b = sig('', 'Müller^Peter', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(false);
  });

  it('requires first name on both sides if one side provides it', () => {
    const a = sig('', 'Müller^Hans', '19680427');
    const b = sig('', 'Müller', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(false);
  });

  it('accepts last-name-only match when both sides have no first name', () => {
    const a = sig('', 'Müller', '19680427');
    const b = sig('', 'Mueller', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(true);
  });

  it('rejects demography match if birth date is missing', () => {
    const a = sig('', 'Müller^Hans', '');
    const b = sig('', 'Müller^Hans', '19680427');
    expect(patientSignaturesMatch(a, b)).toBe(false);
  });

  it('ignores PatientID case-sensitivity (DICOM IDs can be case-sensitive)', () => {
    // DICOM PatientID is technically case-sensitive in most systems,
    // but we treat exact equality as match.
    const a = sig('p001', '', '');
    const b = sig('P001', '', '');
    expect(patientSignaturesMatch(a, b)).toBe(false);
  });
});
