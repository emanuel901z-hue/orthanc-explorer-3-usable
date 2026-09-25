import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockQuarantine } = vi.hoisted(() => ({ mockQuarantine: vi.fn() }));

vi.mock('@/api/pulmopath-pacs', () => ({
  pulmopathPacsApi: { quarantineStudy: mockQuarantine },
}));
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { quarantineStudyAction } from './quarantineStudy';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';

describe('quarantineStudyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls the backend and emits a success audit event', async () => {
    mockQuarantine.mockResolvedValue({
      success: true,
      orthancStudyId: 'new-id',
      previousOrthancStudyId: 'study-abc',
      quarantinePatientId: 'QRN-ADOPT-1',
    });

    const result = await quarantineStudyAction('study-abc', 'duplicate');

    expect(mockQuarantine).toHaveBeenCalledWith({ orthancStudyId: 'study-abc', reason: 'duplicate' });
    expect(result.quarantinePatientId).toBe('QRN-ADOPT-1');
    expect(auditClient.emit).toHaveBeenCalledWith({
      action: 'study.quarantine',
      resourceType: 'study',
      resourceId: 'study-abc',
      outcome: 'started',
      timestamp: '2026-01-01T00:00:00.000Z',
      detail: { reason: 'duplicate' },
    });
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', detail: expect.objectContaining({ quarantinePatientId: 'QRN-ADOPT-1' }) }),
    );
  });

  it('emits a failure event and rethrows on error', async () => {
    const err = new OrthancError(409, 'corr-id', 'already quarantined');
    mockQuarantine.mockRejectedValue(err);

    await expect(quarantineStudyAction('study-abc')).rejects.toBe(err);

    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', errorCode: 409 }),
    );
  });
});
