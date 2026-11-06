import { describe, it, expect } from 'vitest';
import { DIMSE_SUCCESS, extractDimseStatus, formatDimseStatus } from './dimse-status';

describe('extractDimseStatus', () => {
  it('liest den Status aus Details (mehrere Antworten)', () => {
    expect(extractDimseStatus({ Details: [{ DimseErrorStatus: 0 }, { DimseErrorStatus: 0xc000 }] })).toBe(0);
  });

  it('liest den flachen Status', () => {
    expect(extractDimseStatus({ DimseErrorStatus: 0xa700 })).toBe(0xa700);
  });

  it('gibt undefined zurück, wenn Orthanc keinen Status meldet', () => {
    expect(extractDimseStatus({ TargetAet: 'X' })).toBeUndefined();
    expect(extractDimseStatus(undefined)).toBeUndefined();
    expect(extractDimseStatus(null)).toBeUndefined();
  });

  it('ignoriert Details ohne numerischen Status', () => {
    expect(extractDimseStatus({ Details: [{ Query: {} }] })).toBeUndefined();
  });

  it('Erfolg ist 0x0000', () => {
    expect(DIMSE_SUCCESS).toBe(0);
  });
});

describe('formatDimseStatus', () => {
  it('formatiert als vierstellige Hex-Zahl', () => {
    expect(formatDimseStatus(0)).toBe('0x0000');
    expect(formatDimseStatus(0xc000)).toBe('0xC000');
    expect(formatDimseStatus(0xa700)).toBe('0xA700');
  });
});
