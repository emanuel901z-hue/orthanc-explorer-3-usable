import { describe, it, expect } from 'vitest';
import { resourceRefId, resourceRefType, normalizeResourceRefs } from './orthanc-resources';

describe('orthanc-resources', () => {
  it('reads the ID from the string form', () => {
    expect(resourceRefId('41f24091-b06f')).toBe('41f24091-b06f');
    expect(resourceRefType('41f24091-b06f')).toBeUndefined();
  });

  it('reads ID and Type from the object form', () => {
    expect(resourceRefId({ ID: '41f24091-b06f', Type: 'Study' })).toBe('41f24091-b06f');
    expect(resourceRefType({ ID: '41f24091-b06f', Type: 'Study' })).toBe('Study');
  });

  it('ignores empty and malformed references', () => {
    expect(resourceRefId('')).toBeUndefined();
    expect(resourceRefId(null)).toBeUndefined();
    expect(resourceRefId(undefined)).toBeUndefined();
    expect(resourceRefId({ Type: 'Study' })).toBeUndefined();
    expect(resourceRefId({ ID: '' })).toBeUndefined();
  });

  it('normalizes a mixed job resource list to ID strings', () => {
    expect(
      normalizeResourceRefs([
        { ID: 'study-1', Type: 'Study' },
        'instance-1',
        { Type: 'Series' },
        null,
      ]),
    ).toEqual(['study-1', 'instance-1']);
  });

  it('returns an empty list for non-arrays', () => {
    expect(normalizeResourceRefs(undefined)).toEqual([]);
    expect(normalizeResourceRefs({ ID: 'x' })).toEqual([]);
  });
});
