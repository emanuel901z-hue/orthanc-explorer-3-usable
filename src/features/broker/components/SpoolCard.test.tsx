import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SpoolCard } from './SpoolCard';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import '@/i18n';

const { mockStats, mockRetryAll } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockRetryAll: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: { spool: { stats: mockStats, retryAll: mockRetryAll, items: vi.fn(), retry: vi.fn(), discard: vi.fn() } },
}));

const emit = vi.spyOn(auditClient, 'emit');

function stats(overrides = {}) {
  return {
    queued: 0, failed: 0, dead: 0, sent: 0, open: 0, bytes: 0, oldest_age_s: null,
    capacity: { items: 0, bytes: 0, max_items: 20000, max_bytes: 10_737_418_240, full: false },
    enabled: true, accept_when_queued: true,
    ...overrides,
  };
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><SpoolCard /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SpoolCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockRetryAll.mockResolvedValue({ requeued: 3 });
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('reports an empty spool', async () => {
    mockStats.mockResolvedValue(stats());
    renderCard();

    expect(await screen.findByText(/nothing queued/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry all/i })).toBeDisabled();
    expect(screen.getByText(/source of truth|store and forward|kept on disk/i)).toBeInTheDocument();
  });

  it('shows the backlog, the oldest entry and the usage', async () => {
    mockStats.mockResolvedValue(stats({
      queued: 12, failed: 3, open: 15, bytes: 250_000_000, oldest_age_s: 900,
      capacity: { items: 15, bytes: 250_000_000, max_items: 20000, max_bytes: 10_737_418_240, full: false },
    }));
    renderCard();

    await waitFor(() => expect(screen.getByText(/15 waiting/i)).toBeInTheDocument());
    expect(screen.getByText(/oldest 15 min/i)).toBeInTheDocument();
    expect(screen.getByText(/238 MB/)).toBeInTheDocument();
    expect(screen.getByText(/15 of 20000 entries/i)).toBeInTheDocument();
  });

  it('flags dead letters and a full spool', async () => {
    mockStats.mockResolvedValue(stats({
      dead: 2, open: 0,
      capacity: { items: 20000, bytes: 1, max_items: 20000, max_bytes: 10_737_418_240, full: true },
    }));
    renderCard();

    expect(await screen.findByText(/2 dead letter/i)).toBeInTheDocument();
    expect(screen.getByText(/spool full/i)).toBeInTheDocument();
  });

  it('retries all entries after confirmation and audits it', async () => {
    mockStats.mockResolvedValue(stats({ dead: 3, open: 3 }));
    renderCard();
    await waitFor(() => expect(screen.getByText(/3 dead letter/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry all/i }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/put back into the queue/i)).toBeInTheDocument();
    expect(mockRetryAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRetryAll).toHaveBeenCalled());
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.spool.retry_all', resourceId: 'all', outcome: 'started',
    });
  });
});
