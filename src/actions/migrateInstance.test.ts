import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateInstanceAction } from './migrateInstance';
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

describe('migrateInstanceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls studiesApi.merge and emits success audit event', async () => {
    vi.mocked(studiesApi.merge).mockResolvedValue({
      TargetStudy: 'target-study',
      InstancesCount: 1,
      FailedInstancesCount: 0,
    });

    const result = await migrateInstanceAction('target-study', 'instance-1', true);

    expect(studiesApi.merge).toHaveBeenCalledWith('target-study', ['instance-1'], true);
    expect(result.TargetStudy).toBe('target-study');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'instance.migrate', resourceId: 'instance-1' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'instance.migrate', resourceId: 'instance-1' }),
    );
  });
});
