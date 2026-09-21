/**
 * The values the broker API delivers are shown through i18n, and rows open the
 * edit dialog — both were reported as rough edges on the running console.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import BrokerPage from '@/features/broker/pages/BrokerPage';
import SourcesPage from '@/features/broker/pages/SourcesPage';
import { RetentionCard } from '@/features/broker/components/RetentionCard';
import '@/i18n';

const { mockStatus, mockQueries, mockSources, mockRetention } = vi.hoisted(() => ({
  mockStatus: vi.fn(),
  mockQueries: vi.fn(),
  mockSources: vi.fn(),
  mockRetention: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    status: mockStatus,
    logs: { queries: mockQueries, stores: vi.fn(() => Promise.resolve([])) },
    sources: { list: mockSources, echo: vi.fn(), resetBreaker: vi.fn() },
    targets: { list: vi.fn(() => Promise.resolve([])) },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    health: { config: vi.fn(() => Promise.resolve({ findings: [], summary: {} })) },
    rbac: { status: vi.fn(() => Promise.resolve({ enforced: false, can_write: true, write_role: 'brokerWrite', roles: [] })) },
    retention: { overview: mockRetention, purge: vi.fn() },
    settings: { list: vi.fn(() => Promise.resolve([])), set: vi.fn(), reset: vi.fn() },
    cache: { stats: vi.fn(() => Promise.resolve(null)) },
    spool: { stats: vi.fn(() => Promise.resolve(null)) },
  },
}));

const SOURCE = {
  id: 1, name: 'ris-a', aet: 'RIS_A', host: '10.0.1.20', port: 104,
  calling_aet: 'MWLBROKER', charset: 'ISO_IR 100', enabled: true, timeout_s: 10,
  priority: 10, cache_stale_on_error: true, cache_refresh_s: 0,
  tls: false, tls_verify: true, created_at: '2026-09-21T00:00:00Z',
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>,
  );
}

describe('broker values are translated', () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStatus.mockResolvedValue({
      scp_listening: true, db_ok: true, counts: { queries: 0, stores: 0, answers: 0 },
      sources: [], targets: [], echo: [],
    });
    mockQueries.mockResolvedValue([
      { id: 1, calling_aet: 'CT_01', answers: 2, duration_ms: 5, status: 'success',
        served_stale: [], ts: '2026-09-21T10:00:00Z', per_source: {} },
      { id: 2, calling_aet: 'MR_01', answers: 0, duration_ms: 9, status: 'partial',
        served_stale: ['ris-a'], ts: '2026-09-21T10:01:00Z', per_source: {} },
    ]);
    await i18n.changeLanguage('de');
  });
  afterEach(async () => {
    // deliberately no __resetConfigForTests() here: a query that settles during
    // teardown would render without config and raise an unhandled error
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  it('renders the query status in the operator language', async () => {
    wrap(<BrokerPage />);

    // "success" / "partial" used to be printed raw
    expect(await screen.findByText('erfolgreich')).toBeInTheDocument();
    expect(screen.getByText('teilweise')).toBeInTheDocument();
    expect(screen.queryByText('success')).not.toBeInTheDocument();
  });

  it('renders the retention table names in the operator language', async () => {
    mockRetention.mockResolvedValue({
      tables: [{ table: 'query_log', description: 'Worklist queries (PHI-free log)',
                 rows: 3, oldest: null, retention_days: 90, will_delete: 0 }],
    });
    wrap(<RetentionCard />);

    expect(await screen.findByText(/Worklist-Abfragen/)).toBeInTheDocument();
    expect(screen.queryByText(/PHI-free log/)).not.toBeInTheDocument();
  });
});

describe('table rows open the edit dialog', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockSources.mockResolvedValue([SOURCE]);
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('opens the edit dialog when the row is clicked', async () => {
    wrap(<SourcesPage />);
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByText('ris-a'));

    const dialog = await screen.findByRole('dialog');
    // prefilled with the row it was opened from
    expect(within(dialog).getByLabelText(/^name$/i)).toHaveValue('ris-a');
  });

  it('opens the edit dialog with the keyboard as well', async () => {
    wrap(<SourcesPage />);
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.keyDown(screen.getByText('ris-a').closest('tr')!, { key: 'Enter' });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not swallow clicks on the action buttons', async () => {
    wrap(<SourcesPage />);
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    // the delete button must open the confirmation, not the edit dialog
    fireEvent.click(screen.getAllByRole('button', { name: /delete source|quelle löschen/i })[0]);

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('API completeness follow-ups (A4/A5/A6)', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('shows which build is running and for how long', async () => {
    mockStatus.mockResolvedValue({
      version: '1.0.0', started_at: '2026-09-21T08:00:00+00:00', uptime_s: 3 * 86400 + 4 * 3600,
      scp_listening: true, db_ok: true, counts: { queries: 0, stores: 0, answers: 0 },
      sources: [], targets: [], echo: [],
    });
    mockQueries.mockResolvedValue([]);

    wrap(<BrokerPage />);

    const build = await screen.findByTestId('broker-build');
    // label and value sit in separate elements — assert on the card text
    await waitFor(() => expect(build.textContent).toContain('1.0.0'));
    expect(build.textContent).toContain('3 d 4 h');
  });

  it('filters the query log by date instead of paging through weeks', async () => {
    mockStatus.mockResolvedValue({
      version: '1.0.0', started_at: '2026-09-21T08:00:00+00:00', uptime_s: 10,
      scp_listening: true, db_ok: true, counts: { queries: 0, stores: 0, answers: 0 },
      sources: [], targets: [], echo: [],
    });
    mockQueries.mockResolvedValue([]);

    wrap(<BrokerPage />);
    const field = await screen.findByLabelText(/since \(date\)|ab datum/i);
    fireEvent.change(field, { target: { value: '2026-09-20' } });

    await waitFor(() => {
      expect(mockQueries).toHaveBeenCalledWith(expect.objectContaining({ since: '2026-09-20' }));
    });
  });
});
