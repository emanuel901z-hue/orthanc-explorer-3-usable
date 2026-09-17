import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CacheCard } from './CacheCard';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import '@/i18n';

const { mockStats, mockClear } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: { cache: { stats: mockStats, clear: mockClear, clearSource: vi.fn() } },
}));

const emit = vi.spyOn(auditClient, 'emit');

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><CacheCard /></QueryClientProvider>);
}

describe('CacheCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockClear.mockResolvedValue(undefined);
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('reports an empty cache', async () => {
    mockStats.mockResolvedValue([{
      source_id: 1, source_name: 'ris-a', entries: 0, age_s: null, state: 'empty',
      stale_on_error: true, refresh_s: 0, newest_fetched_at: null,
    }]);
    renderCard();

    expect(await screen.findByText('ris-a')).toBeInTheDocument();
    expect(screen.getByText(/^empty$/i)).toBeInTheDocument();
    // header total + the row itself both say "0 items"
    expect(within(screen.getByTestId('broker-cache-list')).getByText(/0 items/i)).toBeInTheDocument();
    // nothing to clear
    expect(screen.getByRole('button', { name: /clear cache/i })).toBeDisabled();
  });

  it('explains itself when no source is configured', async () => {
    mockStats.mockResolvedValue([]);
    renderCard();

    expect(await screen.findByText(/nothing cached yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('broker-cache-list')).not.toBeInTheDocument();
  });

  it('shows entries, age and the fallback state per source', async () => {
    mockStats.mockResolvedValue([
      {
        source_id: 1, source_name: 'ris-a', entries: 42, age_s: 30, state: 'available',
        stale_on_error: true, refresh_s: 300, newest_fetched_at: '2026-09-17T10:00:00Z',
      },
      {
        source_id: 2, source_name: 'ris-b', entries: 7, age_s: 7200, state: 'expired',
        stale_on_error: false, refresh_s: 0, newest_fetched_at: '2026-09-17T08:00:00Z',
      },
    ]);
    renderCard();

    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());
    expect(screen.getByText(/49 items/i)).toBeInTheDocument();       // total in the header
    expect(screen.getByText(/42 items/i)).toBeInTheDocument();
    expect(screen.getByText(/30s/)).toBeInTheDocument();
    expect(screen.getByText(/^available$/i)).toBeInTheDocument();
    expect(screen.getByText(/^expired$/i)).toBeInTheDocument();
    expect(screen.getByText(/2 h/)).toBeInTheDocument();
    expect(screen.getByText(/stale fallback active/i)).toBeInTheDocument();
    expect(screen.getByText(/stale fallback off/i)).toBeInTheDocument();
    expect(screen.getByText(/refresh every 300s/i)).toBeInTheDocument();
    // the semantics are explained to the operator
    expect(screen.getByText(/source of truth/i)).toBeInTheDocument();
  });

  it('clears the cache only after confirmation and audits it', async () => {
    mockStats.mockResolvedValue([{
      source_id: 1, source_name: 'ris-a', entries: 3, age_s: 10, state: 'available',
      stale_on_error: true, refresh_s: 0, newest_fetched_at: '2026-09-17T10:00:00Z',
    }]);
    renderCard();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /clear cache/i }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/can no longer be bridged/i)).toBeInTheDocument();
    expect(mockClear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockClear).toHaveBeenCalled());
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.cache.clear',
      resourceType: 'brokerConfig',
      outcome: 'started',
    });
  });
});
