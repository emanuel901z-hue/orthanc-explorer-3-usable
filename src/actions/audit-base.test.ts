import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAuditBase } from './audit-base';

describe('makeAuditBase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns base audit object with ISO timestamp', () => {
    const base = makeAuditBase('study.send', 'study', 'abc123');
    expect(base).toEqual({
      action: 'study.send',
      resourceType: 'study',
      resourceId: 'abc123',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('resourceType is typed as const', () => {
    const base = makeAuditBase('study.label.add', 'study', 'xyz');
    expect(base.resourceType).toBe('study');
  });
});
