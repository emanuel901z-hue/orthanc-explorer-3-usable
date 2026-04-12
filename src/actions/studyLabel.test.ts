import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/studies', () => ({
  studiesApi: {
    addLabel: vi.fn(),
    removeLabel: vi.fn(),
  },
}));
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { addLabelAction, removeLabelAction } from './studyLabel';
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';

describe('addLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls studiesApi.addLabel and emits success audit event', async () => {
    vi.mocked(studiesApi.addLabel).mockResolvedValue(undefined);
    await addLabelAction('study-abc', 'urgent');
    expect(studiesApi.addLabel).toHaveBeenCalledWith('study-abc', 'urgent');
    expect(auditClient.emit).toHaveBeenCalledWith({
      action: 'study.label.add',
      resourceType: 'study',
      resourceId: 'study-abc',
      outcome: 'success',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('emits failure event and rethrows on error', async () => {
    const err = new OrthancError(503, 'unavailable');
    vi.mocked(studiesApi.addLabel).mockRejectedValue(err);
    await expect(addLabelAction('study-abc', 'urgent')).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', errorCode: 503 }),
    );
  });
});

describe('removeLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls studiesApi.removeLabel and emits success audit event', async () => {
    vi.mocked(studiesApi.removeLabel).mockResolvedValue(undefined);
    await removeLabelAction('study-abc', 'urgent');
    expect(studiesApi.removeLabel).toHaveBeenCalledWith('study-abc', 'urgent');
    expect(auditClient.emit).toHaveBeenCalledWith({
      action: 'study.label.remove',
      resourceType: 'study',
      resourceId: 'study-abc',
      outcome: 'success',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('emits failure event and rethrows on error', async () => {
    const err = new OrthancError(503, 'unavailable');
    vi.mocked(studiesApi.removeLabel).mockRejectedValue(err);
    await expect(removeLabelAction('study-abc', 'urgent')).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    );
  });
});
