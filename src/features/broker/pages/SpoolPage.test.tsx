import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SpoolPage from './SpoolPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import '@/i18n';
import { mockMobileViewport, resetViewport } from '@/test/viewport';

const { mockItems, mockRetry, mockDiscard } = vi.hoisted(() => ({
  mockItems: vi.fn(),
  mockRetry: vi.fn(),
  mockDiscard: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    spool: { items: mockItems, retry: mockRetry, discard: mockDiscard, stats: vi.fn(), retryAll: vi.fn() },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

const ENTRY = {
  id: 7,
  sop_instance_uid: '1.2.840.1',
  study_uid: '9.8.7',
  accession: 'ACC-A-001',
  source_id: 1,
  target_id: 2,
  target_name: 'pacs-peer',
  status: 'failed' as const,
  attempts: 3,
  last_error: 'association rejected',
  payload_bytes: 2_500_000,
  age_s: 180,
  next_attempt_at: '2026-09-17T10:05:00Z',
  sent_at: null,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><SpoolPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SpoolPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockItems.mockResolvedValue([ENTRY]);
    mockRetry.mockResolvedValue({ requeued: 1 });
    mockDiscard.mockResolvedValue(undefined);
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); resetViewport(); vi.clearAllMocks(); });

  it('lists the queued instances with target, attempts and error', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('ACC-A-001')).toBeInTheDocument());
    expect(screen.getByText('pacs-peer')).toBeInTheDocument();
    expect(screen.getByText('association rejected')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
    expect(screen.getByText(/retrying/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
  });

  it('renders the mobile card layout with all fields', async () => {
    mockMobileViewport();
    renderPage();
    await waitFor(() => expect(screen.getByText('ACC-A-001')).toBeInTheDocument());

    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Attempts')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Last error')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry now/i })).toBeInTheDocument();
  });

  it('reports an empty queue', async () => {
    mockItems.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/nothing queued — every instance reached its target/i))
      .toBeInTheDocument();
  });

  it('retries an entry and audits it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ACC-A-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry now/i }));

    await waitFor(() => expect(mockRetry).toHaveBeenCalledWith(7));
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.spool.retry', resourceId: '7', outcome: 'started',
    });
  });

  it('requires a reason before discarding and audits it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ACC-A-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: /^discard$/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: 'du' } });
    expect(confirm).toBeDisabled();  // still too short (minimum is 3 characters)

    fireEvent.change(within(dialog).getByLabelText(/reason/i), {
      target: { value: 'duplicate of a manual import' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(mockDiscard).toHaveBeenCalledWith(7, 'duplicate of a manual import'));
    expect(emit.mock.calls[0][0]).toMatchObject({ action: 'broker.spool.discard' });
  });
});
