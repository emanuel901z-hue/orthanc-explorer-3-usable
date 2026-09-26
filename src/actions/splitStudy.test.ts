import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitStudyAction } from './splitStudy';
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';

vi.mock('@/api/studies', () => ({
  studiesApi: {
    split: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditClient: {
    emit: vi.fn(),
  },
}));

describe('splitStudyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls studiesApi.split and emits success audit event', async () => {
    vi.mocked(studiesApi.split).mockResolvedValue({
      TargetStudy: 'new-study-uuid',
      TargetStudyUID: '1.2.3.4.5',
      InstancesCount: 5,
      FailedInstancesCount: 0,
    });

    const result = await splitStudyAction('source-study-1', {
      Series: ['series-1', 'series-2'],
      KeepSource: false,
    });

    expect(studiesApi.split).toHaveBeenCalledWith('source-study-1', {
      Series: ['series-1', 'series-2'],
      KeepSource: false,
    });
    expect(result.TargetStudy).toBe('new-study-uuid');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'study.split', resourceId: 'source-study-1' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'study.split', detail: expect.objectContaining({ newStudyId: 'new-study-uuid' }) }),
    );
  });
});
