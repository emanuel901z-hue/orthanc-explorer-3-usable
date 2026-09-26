import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateSeriesAction } from './migrateSeries';
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

describe('migrateSeriesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls studiesApi.merge and emits success audit event', async () => {
    vi.mocked(studiesApi.merge).mockResolvedValue({
      TargetStudy: 'target-study',
      InstancesCount: 5,
      FailedInstancesCount: 0,
    });

    const result = await migrateSeriesAction('target-study', 'series-1', false);

    expect(studiesApi.merge).toHaveBeenCalledWith('target-study', ['series-1'], false);
    expect(result.TargetStudy).toBe('target-study');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'series.migrate', resourceId: 'series-1' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'series.migrate', resourceId: 'series-1' }),
    );
  });

  it('records failedInstancesCount when FailedInstancesCount > 0', async () => {
    vi.mocked(studiesApi.merge).mockResolvedValue({
      TargetStudy: 'target-study',
      InstancesCount: 4,
      FailedInstancesCount: 1,
    });

    const result = await migrateSeriesAction('target-study', 'series-1');

    expect(result.FailedInstancesCount).toBe(1);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'series.migrate', detail: expect.objectContaining({ failedInstancesCount: 1 }) }),
    );
  });

  it('supports migrating multiple series IDs at once', async () => {
    vi.mocked(studiesApi.merge).mockResolvedValue({
      TargetStudy: 'target-study',
      InstancesCount: 10,
      FailedInstancesCount: 0,
    });

    const result = await migrateSeriesAction('target-study', ['series-1', 'series-2'], true);

    expect(studiesApi.merge).toHaveBeenCalledWith('target-study', ['series-1', 'series-2'], true);
    expect(result.TargetStudy).toBe('target-study');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'started',
        action: 'series.migrate',
        detail: expect.objectContaining({ seriesIds: ['series-1', 'series-2'], count: 2, keepSource: true }),
      }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        action: 'series.migrate',
        detail: expect.objectContaining({ count: 2, instancesCount: 10 }),
      }),
    );
  });
});
