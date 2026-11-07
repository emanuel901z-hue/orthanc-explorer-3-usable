import { describe, it, expect } from 'vitest';
import { DIMSE_SUCCESS, dimseSeverity, dimseStatusKey, extractDimseStatus, formatDimseStatus } from './dimse-status';

describe('extractDimseStatus', () => {
  it('liest den Status aus Details und lässt keinen Fehler hinter 0x0000 verschwinden', () => {
    expect(extractDimseStatus({ Details: [{ DimseErrorStatus: 0 }] })).toBe(0);
    expect(extractDimseStatus({ Details: [{ DimseErrorStatus: 0 }, { DimseErrorStatus: 0xc000 }] })).toBe(0xc000);
    expect(extractDimseStatus({ Details: [{ DimseErrorStatus: 0 }, { DimseErrorStatus: 0xb000 }] })).toBe(0xb000);
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

describe('dimseSeverity — 0xBxxx ist eine Warnung, kein Erfolg', () => {
  it('bewertet 0x0000 als Erfolg', () => {
    expect(dimseSeverity(0x0000)).toBe('success');
  });

  it('bewertet Teilfehler als Warnung', () => {
    expect(dimseSeverity(0xb000)).toBe('warning');
    expect(dimseSeverity(0xb007)).toBe('warning');
  });

  it('bewertet Ablehnungen und Fehler als Fehlschlag', () => {
    expect(dimseSeverity(0xa700)).toBe('error');
    expect(dimseSeverity(0xa801)).toBe('error');
    expect(dimseSeverity(0xc000)).toBe('error');
    expect(dimseSeverity(0xfe00)).toBe('error');
  });

  it('ohne Status ist es kein Erfolg', () => {
    expect(dimseSeverity(undefined)).toBe('error');
  });
});

describe('dimseStatusKey — sprechende Bedeutung', () => {
  it('ordnet die häufigen Codes zu', () => {
    expect(dimseStatusKey(0x0000)).toBe('success');
    expect(dimseStatusKey(0xb000)).toBe('partial');
    expect(dimseStatusKey(0xa700)).toBe('outOfResources');
    expect(dimseStatusKey(0xa801)).toBe('unknownDestination');
    expect(dimseStatusKey(0xa900)).toBe('dataSetMismatch');
    expect(dimseStatusKey(0xc000)).toBe('unableToProcess');
    expect(dimseStatusKey(0xfe00)).toBe('canceled');
  });

  it('kennt einen Rest und den fehlenden Status', () => {
    expect(dimseStatusKey(0x0123)).toBe('other');
    expect(dimseStatusKey(undefined)).toBe('unknown');
  });
});
