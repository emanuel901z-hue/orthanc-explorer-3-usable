import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SendToPeerDialog } from './SendToPeerDialog';
import { peersApi } from '@/api/peers';
import '@/i18n';

const { mockSendToPeer } = vi.hoisted(() => ({ mockSendToPeer: vi.fn() }));

vi.mock('@/actions/sendToPeer', () => ({
  sendToPeerAction: mockSendToPeer,
}));

vi.mock('@/api/peers', () => ({
  peersApi: {
    list: vi.fn(),
  },
}));

function renderDialog(open = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SendToPeerDialog
        open={open}
        onOpenChange={() => {}}
        resourceId="study-1"
        resourceLabel="Patient^Demo"
        resourceType="study"
      />
    </QueryClientProvider>,
  );
}

describe('SendToPeerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders configured peers and sends when selected', async () => {
    vi.mocked(peersApi.list).mockResolvedValue(['peer-cloud', 'peer-backup']);
    mockSendToPeer.mockResolvedValue({ Description: 'Success' });

    renderDialog();

    await waitFor(() => {
      expect(screen.getByText('peer-cloud')).toBeInTheDocument();
      expect(screen.getByText('peer-backup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('peer-cloud'));
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockSendToPeer).toHaveBeenCalledWith('peer-cloud', 'study-1', 'study');
    });
  });

  it('shows no peers message when list is empty', async () => {
    vi.mocked(peersApi.list).mockResolvedValue([]);

    renderDialog();

    await waitFor(() => {
      expect(screen.getByText(/No Orthanc peers configured/i)).toBeInTheDocument();
    });
  });
});
