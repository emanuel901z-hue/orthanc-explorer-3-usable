/**
 * Reporting card: volume, failures and the daily series — PHI-free.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { StatsCard } from './StatsCard';
import '@/i18n';

const { mockOverview } = vi.hoisted(() => ({ mockOverview: vi.fn() }));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    statsOverview: mockOverview,
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true,
                                                  write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
  },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><StatsCard /></MemoryRouter></QueryClientProvider>,
  );
}

const DATA = {
  totals: {
    days: 7, from: '', to: '', queries: 12, answers: 34, queries_failed: 2,
    queries_from_cache: 1, avg_duration_ms: 120, stores: 8, stores_forwarded: 7,
    stores_failed: 1, stores_unrouted: 0, mpps_steps: 3, mpps_completed: 3,
    mpps_pending_forward: 1, spool_open: 2, spool_dead: 0,
  },
  groups: [
    { name: 'ris-a', queries: 12, answers: 30, queries_failed: 1, stores: 8, stores_failed: 1 },
    { name: 'ris-b', queries: 12, answers: 4, queries_failed: 1, stores: 0, stores_failed: 0 },
  ],
  series: [
    { day: '2026-09-20', queries: 3, stores: 2, mpps: 1 },
    { day: '2026-09-21', queries: 9, stores: 6, mpps: 2 },
  ],
  group_by: 'source',
};

describe('StatsCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockOverview.mockResolvedValue(DATA);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows the totals including failures', async () => {
    renderCard();

    const totals = await screen.findByTestId('stats-totals');
    await waitFor(() => expect(totals.textContent).toContain('12'));
    expect(totals.textContent).toMatch(/2 ohne Antwort|2 without an answer/);
    expect(totals.textContent).toMatch(/1 nicht zugestellt|1 not forwarded/);
  });

  it('lists the breakdown per source', async () => {
    renderCard();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('ris-a')).toBeInTheDocument();
    expect(within(table).getByText('ris-b')).toBeInTheDocument();
    expect(within(table).getAllByText('12').length).toBeGreaterThanOrEqual(2);
  });

  it('draws the daily series', async () => {
    renderCard();

    const series = await screen.findByTestId('stats-series');
    // one bar per day in the period
    expect(series.children.length).toBe(2);
    expect(series.children[1].getAttribute('title')).toContain('2026-09-21');
  });

  it('explains an empty period instead of showing nothing', async () => {
    mockOverview.mockResolvedValue({
      ...DATA,
      groups: [],
      totals: { ...DATA.totals, queries: 0, stores: 0 },
    });
    renderCard();

    expect(await screen.findByText(/keine Daten|no data/i)).toBeInTheDocument();
  });
});
