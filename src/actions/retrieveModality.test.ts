import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retrieveModalityAction } from './retrieveModality';
import { queriesApi } from '@/api/queries';
import { auditClient } from '@/lib/audit';

vi.mock('@/api/queries', () => ({
  queriesApi: {
    retrieveAnswer: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditClient: {
    emit: vi.fn(),
  },
}));

describe('retrieveModalityAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiates retrieve and emits audit events', async () => {
    vi.mocked(queriesApi.retrieveAnswer).mockResolvedValue({ Description: 'Success' });

    await retrieveModalityAction('MODALITY_1', 'q-1', 0, 'LOCAL_AET');

    expect(queriesApi.retrieveAnswer).toHaveBeenCalledWith('q-1', 0, 'LOCAL_AET');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'modality.retrieve', resourceId: 'MODALITY_1' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'modality.retrieve', resourceId: 'MODALITY_1' }),
    );
  });
});
