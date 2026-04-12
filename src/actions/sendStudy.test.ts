import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/studies', () => ({
  studiesApi: {
    sendToModality: vi.fn(),
  },
}));
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { sendStudyAction } from './sendStudy';
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';

describe('sendStudyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls studiesApi.sendToModality and emits success audit event', async () => {
    vi.mocked(studiesApi.sendToModality).mockResolvedValue(undefined);

    await sendStudyAction('study-abc', 'PACS_PRIMARY');

    expect(studiesApi.sendToModality).toHaveBeenCalledWith('study-abc', 'PACS_PRIMARY');
    expect(auditClient.emit).toHaveBeenCalledWith({
      action: 'study.send',
      resourceType: 'study',
      resourceId: 'study-abc',
      outcome: 'success',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('emits failure audit event and rethrows on error', async () => {
    const err = new OrthancError(503, 'unavailable', 'Service temporarily unavailable.');
    vi.mocked(studiesApi.sendToModality).mockRejectedValue(err);

    await expect(sendStudyAction('study-abc', 'PACS_PRIMARY')).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', errorCode: 503 }),
    );
  });
});
