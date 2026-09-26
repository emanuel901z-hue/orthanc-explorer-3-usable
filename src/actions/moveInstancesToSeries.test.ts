import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moveInstancesToSeriesAction } from './moveInstancesToSeries';
import { toolsApi } from '@/api/tools';
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';

vi.mock('@/api/tools', () => ({
  toolsApi: {
    bulkModify: vi.fn(),
  },
}));

vi.mock('@/api/instances', () => ({
  instancesApi: {
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditClient: {
    emit: vi.fn(),
  },
}));

const bulkResult = (over: Record<string, unknown> = {}) => ({
  InstancesCount: 2,
  FailedInstancesCount: 0,
  Resources: [
    { ID: 'new-1', Path: '/instances/new-1', Type: 'Instance' },
    { ID: 'new-2', Path: '/instances/new-2', Type: 'Instance' },
  ],
  ...over,
});

describe('moveInstancesToSeriesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the modified copies in the target series and cuts the sources', async () => {
    vi.mocked(toolsApi.bulkModify).mockResolvedValue(bulkResult());
    vi.mocked(instancesApi.delete).mockResolvedValue(undefined);

    const result = await moveInstancesToSeriesAction({
      instanceIds: ['inst-1', 'inst-2'],
      targetSeriesUid: '1.2.3.4',
    });

    expect(toolsApi.bulkModify).toHaveBeenCalledWith({
      Resources: ['inst-1', 'inst-2'],
      Replace: { SeriesInstanceUID: '1.2.3.4' },
      Force: true,
    });
    expect(instancesApi.delete).toHaveBeenCalledTimes(2);
    expect(result.deletedCount).toBe(2);
    expect(result.deleteFailures).toEqual([]);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'started',
        action: 'instance.move-series',
        resourceId: 'inst-1',
      }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        action: 'instance.move-series',
        detail: expect.objectContaining({ deletedCount: 2, targetSeriesUid: '1.2.3.4' }),
      }),
    );
  });

  it('merges extra replacements (new series attributes) into the Replace body', async () => {
    vi.mocked(toolsApi.bulkModify).mockResolvedValue(bulkResult());

    await moveInstancesToSeriesAction({
      instanceIds: ['inst-1', 'inst-2'],
      targetSeriesUid: '2.25.99',
      replace: { SeriesNumber: '7', SeriesDescription: 'New Series' },
      keepSource: true,
    });

    expect(toolsApi.bulkModify).toHaveBeenCalledWith({
      Resources: ['inst-1', 'inst-2'],
      Replace: {
        SeriesInstanceUID: '2.25.99',
        SeriesNumber: '7',
        SeriesDescription: 'New Series',
      },
      Force: true,
    });
  });

  it('keeps the sources in copy mode', async () => {
    vi.mocked(toolsApi.bulkModify).mockResolvedValue(bulkResult());

    const result = await moveInstancesToSeriesAction({
      instanceIds: ['inst-1', 'inst-2'],
      targetSeriesUid: '1.2.3.4',
      keepSource: true,
    });

    expect(instancesApi.delete).not.toHaveBeenCalled();
    expect(result.deletedCount).toBe(0);
  });

  it('never deletes sources when Orthanc reports failed instances', async () => {
    vi.mocked(toolsApi.bulkModify).mockResolvedValue(
      bulkResult({ InstancesCount: 2, FailedInstancesCount: 1 }),
    );

    const result = await moveInstancesToSeriesAction({
      instanceIds: ['inst-1', 'inst-2'],
      targetSeriesUid: '1.2.3.4',
    });

    expect(instancesApi.delete).not.toHaveBeenCalled();
    expect(result.deletedCount).toBe(0);
    expect(result.FailedInstancesCount).toBe(1);
  });

  it('collects delete failures and still returns the stored copies', async () => {
    vi.mocked(toolsApi.bulkModify).mockResolvedValue(bulkResult());
    vi.mocked(instancesApi.delete)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('delete failed'));

    const result = await moveInstancesToSeriesAction({
      instanceIds: ['inst-1', 'inst-2'],
      targetSeriesUid: '1.2.3.4',
    });

    expect(result.deletedCount).toBe(1);
    expect(result.deleteFailures).toEqual(['inst-2']);
  });

  it('emits a failure audit event and rethrows when bulk-modify fails', async () => {
    vi.mocked(toolsApi.bulkModify).mockRejectedValue(new Error('boom'));

    await expect(
      moveInstancesToSeriesAction({ instanceIds: ['inst-1'], targetSeriesUid: '1.2.3.4' }),
    ).rejects.toThrow('boom');

    expect(instancesApi.delete).not.toHaveBeenCalled();
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', action: 'instance.move-series' }),
    );
  });
});
