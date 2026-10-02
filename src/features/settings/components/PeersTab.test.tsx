import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PeersTab } from './PeersTab';
import '@/i18n';

const { mockList, mockGet, mockPut, mockDelete, mockToast } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: mockToast }));
vi.mock('@/api/peers', () => ({
  peersApi: { list: mockList, get: mockGet, put: mockPut, delete: mockDelete },
}));

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PeersTab /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PeersTab', () => {
  beforeEach(() => {
    // ohne clearAllMocks zählt der nächste Test die Aufrufe des vorigen mit
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
    mockGet.mockResolvedValue({ Url: 'http://pacs-kh:8042' });
    mockPut.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
  });

  it('explains what a peer is when there is none', async () => {
    renderTab();
    expect(await screen.findByText(/No peers yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Add the Orthanc of the other house/i)).toBeInTheDocument();
  });

  it('lists the peers with their URL', async () => {
    mockList.mockResolvedValue(['pacs-kh']);
    renderTab();

    expect(await screen.findByText('pacs-kh')).toBeInTheDocument();
    expect(await screen.findByText('http://pacs-kh:8042')).toBeInTheDocument();
  });

  it('adds a peer with name and URL', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /add peer/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^name$/i), { target: { value: 'pacs-kh' } });
    fireEvent.change(within(dialog).getByLabelText(/^url$/i), { target: { value: 'http://pacs-kh:8042' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('pacs-kh', { Url: 'http://pacs-kh:8042' }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
  });

  it('refuses to save without a name or URL', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /add peer/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    expect(await within(dialog).findByText(/Please enter a name/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Please enter the URL/i)).toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('removes a peer only after confirming', async () => {
    mockList.mockResolvedValue(['pacs-kh']);
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /remove/i }));
    expect(mockDelete).not.toHaveBeenCalled();          // still a question

    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/Images already sent stay where they are/i)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('pacs-kh'));
  });
});
