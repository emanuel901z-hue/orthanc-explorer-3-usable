import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import StationsPage from './StationsPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import { mockMobileViewport, resetViewport } from '@/test/viewport';
import '@/i18n';

const { mockList, mockCreate, mockUpdate, mockRemove, mockSources, mockSimulate } = vi.hoisted(() => ({
  mockList: vi.fn(), mockCreate: vi.fn(), mockUpdate: vi.fn(), mockRemove: vi.fn(),
  mockSources: vi.fn(), mockSimulate: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    stationRules: { list: mockList, create: mockCreate, update: mockUpdate, remove: mockRemove, simulate: mockSimulate },
    sources: { list: mockSources },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

const RULE = {
  id: 1, name: 'ct-hides-ris-b', station_aet: 'CT_01', mode: 'deny' as const,
  source_ids: [2], source_priority: { 2: 1 }, priority: 10, enabled: true,
  created_at: '2026-09-17T10:00:00',
};

const PREVIEW = {
  station_aet: 'CT_01', rule_id: 1, rule_name: 'ct-hides-ris-b', mode: 'deny' as const,
  sources: [
    { id: 1, name: 'ris-a', visible: true, effective_priority: 10 },
    { id: 2, name: 'ris-b', visible: false, effective_priority: 1 },
  ],
  reason: "station rule 'ct-hides-ris-b' (deny [2])",
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><StationsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StationsPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockList.mockResolvedValue([RULE]);
    mockSources.mockResolvedValue([
      { id: 1, name: 'ris-a', aet: 'RIS_A', host: 'h', port: 1, calling_aet: 'M', charset: 'ISO_IR 100', enabled: true, timeout_s: 5, priority: 10, created_at: '' },
      { id: 2, name: 'ris-b', aet: 'RIS_B', host: 'h', port: 1, calling_aet: 'M', charset: 'ISO_IR 100', enabled: true, timeout_s: 5, priority: 20, created_at: '' },
    ]);
    mockCreate.mockResolvedValue(RULE);
    mockUpdate.mockResolvedValue(RULE);
    mockRemove.mockResolvedValue(undefined);
    mockSimulate.mockResolvedValue(PREVIEW);
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); resetViewport(); vi.clearAllMocks(); });

  it('lists the rules with the source names', async () => {
    renderPage();

    expect(await screen.findByText('ct-hides-ris-b')).toBeInTheDocument();
    expect(screen.getByText('CT_01')).toBeInTheDocument();
    expect(screen.getByText('deny')).toBeInTheDocument();
    expect(screen.getByText('ris-b')).toBeInTheDocument();   // resolved from the ID
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('creates a rule with the selected sources and audits it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^name$/i), { target: { value: 'xr-only' } });
    fireEvent.change(within(dialog).getByLabelText(/station ae title/i), { target: { value: 'XR_01' } });
    fireEvent.click(within(dialog).getByLabelText('source-ris-a'));
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'xr-only', station_aet: 'XR_01', source_ids: [1],
    });
    expect(emit.mock.calls[0][0]).toMatchObject({ action: 'broker.station_rule.create' });
  });

  it('previews what a station would see', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    const preview = screen.getByTestId('broker-station-preview');
    fireEvent.change(within(preview).getByLabelText(/station ae title/i), { target: { value: 'CT_01' } });
    fireEvent.click(within(preview).getByRole('button', { name: /check station/i }));

    await waitFor(() => expect(mockSimulate).toHaveBeenCalledWith('CT_01'));
    const result = await screen.findByTestId('broker-station-preview-result');
    expect(result).toHaveTextContent('ct-hides-ris-b');
    expect(result).toHaveTextContent('ris-a');
    expect(within(result).getByText(/visible/i)).toBeInTheDocument();
    expect(within(result).getByText(/hidden/i)).toBeInTheDocument();
  });

  it('previews from a rule row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /check station/i })[0]);

    await waitFor(() => expect(mockSimulate).toHaveBeenCalledWith('CT_01'));
  });

  it('deletes a rule only after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    expect(mockRemove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(1));
  });

  it('warns when mode allow has no source (empty worklist)', async () => {
    // an existing rule in that state is enough — the Radix Select interaction
    // itself is covered by the Playwright suite (jsdom cannot drive it)
    mockList.mockResolvedValue([{
      ...RULE, name: 'broken', mode: 'allow' as const, source_ids: [],
    }]);
    renderPage();
    await waitFor(() => expect(screen.getByText('broken')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByRole('alert'))
      .toHaveTextContent(/hides every source/i);
  });

  it('does not warn for a rule that names its sources', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the dialog scrollable on a small screen', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
    const dialog = await screen.findByRole('dialog');

    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.className).toContain('overflow-y-auto');
  });

  it('renders the mobile card layout', async () => {
    mockMobileViewport();
    renderPage();
    await waitFor(() => expect(screen.getByText('ct-hides-ris-b')).toBeInTheDocument());

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument();
  });
});
