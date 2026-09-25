import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToPeerAction } from './sendToPeer';
import { peersApi } from '@/api/peers';
import { auditClient } from '@/lib/audit';

vi.mock('@/api/peers', () => ({
  peersApi: {
    send: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditClient: {
    emit: vi.fn(),
  },
}));

describe('sendToPeerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls peersApi.send and emits success audit event', async () => {
    vi.mocked(peersApi.send).mockResolvedValue({ Description: 'Success' });

    await sendToPeerAction('orthanc-cloud', 'study-123', 'study');

    expect(peersApi.send).toHaveBeenCalledWith('orthanc-cloud', 'study-123');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'peer.send', resourceId: 'orthanc-cloud' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'peer.send', resourceId: 'orthanc-cloud' }),
    );
  });
});
