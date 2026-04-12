import { describe, it, expect } from 'vitest';
import { mapDicomTagEntries } from './dicom-tag-utils';

describe('mapDicomTagEntries', () => {
  it('maps tag code to name using Name field', () => {
    const result = mapDicomTagEntries({ '0010,0020': { Name: 'PatientID', Type: 'LO', Value: 'P001' } });
    expect(result).toEqual([{ tag: '0010,0020', name: 'PatientID', vr: 'LO', value: 'P001' }]);
  });

  it('falls back to tag code when Name is missing', () => {
    const result = mapDicomTagEntries({ '0010,0020': { Value: 'P001' } });
    expect(result[0].name).toBe('0010,0020');
  });

  it('returns empty string for null Value', () => {
    const result = mapDicomTagEntries({ '0010,0020': { Value: null } });
    expect(result[0].value).toBe('');
  });

  it('JSON-stringifies non-string Value', () => {
    const result = mapDicomTagEntries({ '0010,0020': { Value: ['a', 'b'] as unknown as string } });
    expect(result[0].value).toBe('["a","b"]');
  });

  it('returns empty array for empty input', () => {
    expect(mapDicomTagEntries({})).toEqual([]);
  });
});
