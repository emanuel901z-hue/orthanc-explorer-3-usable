import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeStudyAction } from './mergeStudy';
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';

vi.mock('@/api/studies', () => ({
  studiesApi: {
    merge: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditClient: {
    emit: vi.fn(),
  },
}));

describe('mergeStudyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits success when all instances merge successfully', async () => {
    vi.mocked(studiesApi.merge).mockResolvedValue({
      TargetStudy: 'target-1',
      InstancesCount: 10,
      FailedInstancesCount: 0,
    });

    const result = await mergeStudyAction('target-1', ['source-1', 'source-2'], false);

    expect(studiesApi.merge).toHaveBeenCalledWith('target-1', ['source-1', 'source-2'], false);
    expect(result.TargetStudy).toBe('target-1');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'study.merge' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'study.merge' }),
    );
  });

  it('records failedInstancesCount in audit event when FailedInstancesCount > 0', async () => {
    vi.mocked(studiesApi.merge).mockResolvedValue({
      TargetStudy: 'target-1',
      InstancesCount: 8,
      FailedInstancesCount: 2,
    });

    const result = await mergeStudyAction('target-1', ['source-1'], true);

    expect(result.FailedInstancesCount).toBe(2);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        action: 'study.merge',
        detail: expect.objectContaining({ failedInstancesCount: 2 }),
      }),
    );
  });

  it('emits failure outcome and rethrows on API error', async () => {
    vi.mocked(studiesApi.merge).mockRejectedValue(new Error('Network error'));

    await expect(mergeStudyAction('target-1', ['source-1'])).rejects.toThrow('Network error');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', action: 'study.merge' }),
    );
  });
});
