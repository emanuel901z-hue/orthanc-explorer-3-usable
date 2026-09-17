import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BrokerPage from './BrokerPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockStatus, mockQueries, mockSources, mockTargets } = vi.hoisted(() => ({
  mockStatus: vi.fn(),
  mockQueries: vi.fn(),
  mockSources: vi.fn(),
  mockTargets: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    status: mockStatus,
    logs: { queries: mockQueries, stores: vi.fn(() => Promise.resolve([])) },
    sources: { list: mockSources, echo: vi.fn() },
    targets: { list: mockTargets, echo: vi.fn() },
    rules: { list: vi.fn(() => Promise.resolve([])) },
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
});
