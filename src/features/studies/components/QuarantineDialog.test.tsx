import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';

const { mockAction } = vi.hoisted(() => ({ mockAction: vi.fn() }));

vi.mock('@/actions/quarantineStudy', () => ({ quarantineStudyAction: mockAction }));

import QuarantineDialog from './QuarantineDialog';

const OK_RESULT = {
  success: true,
  orthancStudyId: 'new-id',
  previousOrthancStudyId: 'old-id',
  quarantinePatientId: 'QRN-ADOPT-1',
};

function renderDialog(studies: { id: string }[], onDone?: (r: { ok: number; failed: number }) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuarantineDialog open onOpenChange={() => {}} studies={studies} onDone={onDone} />
    </QueryClientProvider>,
  );
}

describe('QuarantineDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quarantines every selected study and reports the counts', async () => {
    mockAction.mockResolvedValue(OK_RESULT);
    const onDone = vi.fn();
    renderDialog([{ id: 's1' }, { id: 's2' }], onDone);

    fireEvent.click(screen.getByRole('button', { name: /quarantine|quarantäne/i }));

    await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(2));
    expect(mockAction).toHaveBeenNthCalledWith(1, 's1', undefined);
    expect(mockAction).toHaveBeenNthCalledWith(2, 's2', undefined);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ ok: 2, failed: 0 }));
  });

  it('passes the reason to the action', async () => {
    mockAction.mockResolvedValue(OK_RESULT);
    renderDialog([{ id: 's1' }]);

    fireEvent.change(screen.getByLabelText(/reason|grund/i), { target: { value: 'duplicate' } });
    fireEvent.click(screen.getByRole('button', { name: /quarantine|quarantäne/i }));

    await waitFor(() => expect(mockAction).toHaveBeenCalledWith('s1', 'duplicate'));
  });

  it('counts failures instead of aborting the run', async () => {
    mockAction
      .mockResolvedValueOnce(OK_RESULT)
      .mockRejectedValueOnce(new Error('conflict'));
    const onDone = vi.fn();
    renderDialog([{ id: 's1' }, { id: 's2' }], onDone);

    fireEvent.click(screen.getByRole('button', { name: /quarantine|quarantäne/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ ok: 1, failed: 1 }));
  });
});
