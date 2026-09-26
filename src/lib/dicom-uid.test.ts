import { describe, it, expect } from 'vitest';
import { generateDicomUid } from './dicom-uid';

describe('generateDicomUid', () => {
  it('returns a valid UUID-derived DICOM UID under the 2.25 root', () => {
    const uid = generateDicomUid();
    expect(uid).toMatch(/^2\.25\.(0|[1-9]\d*)$/);
    expect(uid.length).toBeLessThanOrEqual(64);
  });

  it('generates distinct UIDs', () => {
    const uids = new Set(Array.from({ length: 50 }, () => generateDicomUid()));
    expect(uids.size).toBe(50);
  });
});
