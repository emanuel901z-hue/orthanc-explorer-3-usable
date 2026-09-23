import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BrokerPage from './BrokerPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockStatus, mockQueries, mockStores, mockSources, mockTargets, mockHealth, mockResetBreaker } = vi.hoisted(() => ({
  mockStatus: vi.fn(),
  mockQueries: vi.fn(),
  mockStores: vi.fn(),
  mockSources: vi.fn(),
  mockTargets: vi.fn(),
  mockHealth: vi.fn(),
  mockResetBreaker: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    status: mockStatus,
    logs: { queries: mockQueries, stores: mockStores },
    sources: { list: mockSources, echo: vi.fn(), resetBreaker: mockResetBreaker },
    targets: { list: mockTargets, echo: vi.fn() },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    health: { config: mockHealth },
    rbac: { status: vi.fn(() => Promise.resolve({
      mode: 'off', enforced: false, roles_header: 'X-OE3-Roles',
      write_role: 'brokerWrite', roles: [], can_write: true,
    })) },
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BrokerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BrokerPage', () => {
  beforeEach(() => {
    mockStatus.mockResolvedValue({
      scp_listening: true,
      db_ok: true,
      sources: [
        { kind: 'source', id: 1, name: 'ris-a', ok: true, rtt_ms: 12, last_check: '2026-09-16T10:00:00Z', error: null },
      ],
      targets: [
        { kind: 'target', id: 1, name: 'orthanc', ok: false, rtt_ms: null, last_check: '2026-09-16T10:00:00Z', error: 'connection refused' },
      ],
      counts: { queries: 42, stores: 7, seen_items: 9 },
    });
    mockQueries.mockResolvedValue([]);
    mockStores.mockResolvedValue([]);
    mockHealth.mockResolvedValue({ findings: [], summary: { error: 0, warning: 0, info: 0 } });
    mockResetBreaker.mockResolvedValue({ source_id: 1, name: 'ris-a', state: 'closed' });
    mockSources.mockResolvedValue([
      { id: 1, name: 'ris-a', aet: 'RIS_A', host: 'ris.local', port: 11114, calling_aet: 'MWLBROKER', charset: 'ISO_IR 100', enabled: true, timeout_s: 10, priority: 10, created_at: '' },
    ]);
    mockTargets.mockResolvedValue([
      { id: 1, name: 'orthanc', aet: 'ORTHANC', host: 'orthanc', port: 4242, calling_aet: 'MWLBROKER', enabled: true, is_default: true, created_at: '' },
    ]);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows not-configured hint when brokerUrl is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', authMode: 'none', features: {} };
    loadConfig();
    renderPage();
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('renders status cards, echo matrix and endpoint details', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    renderPage();
    await waitFor(() => expect(screen.getByText('RIS_A@ris.local:11114')).toBeInTheDocument());
    expect(screen.getByText('ORTHANC@orthanc:4242')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument(); // query count
    expect(screen.getByText('12 ms')).toBeInTheDocument(); // echo RTT
  });

  it('shows error banner when the status query fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStatus.mockRejectedValue(new Error('broker unreachable'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument(),
    );
  });

  it('renders empty states when no sources/targets exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStatus.mockResolvedValue({
      scp_listening: true, db_ok: true,
      sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    });
    mockSources.mockResolvedValue([]);
    mockTargets.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No sources configured/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/No targets configured/i)).toBeInTheDocument();
  });

  it('renders the configuration health panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockHealth.mockResolvedValue({
      findings: [{
        code: 'no_default_target', severity: 'error',
        message: 'fallback', entity: {}, details: {},
      }],
      summary: { error: 1, warning: 0, info: 0 },
    });
    renderPage();

    await waitFor(() => expect(screen.getByTestId('broker-health')).toBeInTheDocument());
    expect(await screen.findByText(/no enabled default target/i)).toBeInTheDocument();
  });

  it('shows an open circuit breaker and renders skipped sources in the log', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStatus.mockResolvedValue({
      scp_listening: true, db_ok: true,
      sources: [{
        kind: 'source', id: 1, name: 'ris-a', ok: false, rtt_ms: null,
        last_check: '2026-09-16T10:00:00Z', error: 'refused',
        breaker_state: 'open', breaker_retry_in_s: 15,
      }],
      targets: [],
      counts: { queries: 1, stores: 0, seen_items: 0 },
    });
    mockQueries.mockResolvedValue([{
      id: 1, ts: '2026-09-16T10:00:00Z', calling_aet: 'TESTSCU',
      query_keys: {}, answers: 2, per_source: { 'ris-a': 'breaker_open', 'ris-b': 2 },
      duration_ms: 12, status: 'partial',
    }]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/breaker open/i)).toBeInTheDocument());
    expect(screen.getByText(/skipped \(breaker\)/i)).toBeInTheDocument();
  });

  it('warns while a source is served from the cache', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockQueries.mockResolvedValue([{
      id: 1, ts: '2026-09-17T10:00:00Z', calling_aet: 'CT_01',
      query_keys: {}, answers: 2, per_source: { 'ris-a': 2 },
      served_stale: ['ris-a'], duration_ms: 11, status: 'partial',
    }]);
    renderPage();

    const banner = await screen.findByTestId('broker-stale-banner');
    expect(banner).toHaveTextContent('ris-a');
    expect(banner).toHaveTextContent(/from cache/i);
    // the banner *and* the log row mark it
    expect(screen.getAllByText(/from cache/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows no stale banner when everything answered live', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockQueries.mockResolvedValue([{
      id: 1, ts: '2026-09-17T10:00:00Z', calling_aet: 'CT_01',
      query_keys: {}, answers: 2, per_source: { 'ris-a': 2 },
      served_stale: null, duration_ms: 9, status: 'success',
    }]);
    renderPage();

    await waitFor(() => expect(mockQueries).toHaveBeenCalled());
    expect(screen.queryByTestId('broker-stale-banner')).not.toBeInTheDocument();
  });

  it('echo button triggers a manual C-ECHO for that row', async () => {
    const { brokerApi } = await import('@/api/broker');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());
    const btn = screen.getAllByRole('button', { name: /echo/i })[0];
    btn.click();
    await waitFor(() =>
      expect(vi.mocked(brokerApi.sources.echo)).toHaveBeenCalledWith(1),
    );
  });
  it('zeigt, was der Broker ausgeliefert hat', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStores.mockResolvedValue([
      { id: 1, ts: '2026-09-23T10:15:30Z', calling_aet: 'DVTK_MOD', sop_instance_uid: '1.2.3',
        study_uid: '1.2.3.4', accession: 'ACC-A-001', source_id: 1, target_id: 2,
        status: 'success', error: '' },
    ]);
    renderPage();

    const card = await screen.findByTestId('broker-store-log');
    await waitFor(() => expect(within(card).getByText('ACC-A-001')).toBeInTheDocument());
    expect(within(card).getByText('DVTK_MOD')).toBeInTheDocument();
  });
});
