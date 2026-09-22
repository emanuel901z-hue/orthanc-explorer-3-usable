/**
 * The station matrix answers "which console sees what" before a rollout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { StationMatrixCard } from './StationMatrixCard';
import '@/i18n';

const { mockPreview } = vi.hoisted(() => ({ mockPreview: vi.fn() }));
vi.mock('@/api/broker', () => ({
  brokerApi: {
    stationsPreview: mockPreview,
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true,
                                                  write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
  },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><StationMatrixCard /></MemoryRouter></QueryClientProvider>,
  );
}

const STATIONS = {
  source_count: 2,
  stations: [
    { station_aet: 'CT_01', rule_id: 1, rule_name: 'ct-only', mode: 'allow',
      sources: [ { id: 1, name: 'ris-a', visible: true, effective_priority: 10 },
                 { id: 2, name: 'ris-b', visible: false, effective_priority: 20 } ],
      reason: '' },
    { station_aet: 'MR_01', rule_id: null, rule_name: null, mode: null,
      sources: [ { id: 1, name: 'ris-a', visible: true, effective_priority: 10 },
                 { id: 2, name: 'ris-b', visible: true, effective_priority: 20 } ],
      reason: '' },
  ],
};

describe('StationMatrixCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockPreview.mockResolvedValue(STATIONS);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows per station which sources are visible and which are hidden', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /compare|vergleichen/i }));

    const table = await screen.findByTestId('station-matrix-result');
    await waitFor(() => expect(within(table).getByText('CT_01')).toBeInTheDocument());
    const ctRow = within(table).getByText('CT_01').closest('tr')!;
    expect(within(ctRow).getByText(/ris-a/)).toBeInTheDocument();
    expect(within(ctRow).getByText('ris-b')).toBeInTheDocument();   // hidden column
    expect(within(ctRow).getByText('ct-only')).toBeInTheDocument();
  });

  it('passes the entered AETs to the API', async () => {
    renderCard();
    fireEvent.change(screen.getByLabelText(/station aets|station-aets/i),
                     { target: { value: 'ct_01, mr_01' } });
    fireEvent.click(screen.getByRole('button', { name: /compare|vergleichen/i }));

    await waitFor(() => expect(mockPreview).toHaveBeenCalledWith(['ct_01', 'mr_01']));
  });

  it('asks for all rules when the field is empty', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /compare|vergleichen/i }));

    await waitFor(() => expect(mockPreview).toHaveBeenCalledWith([]));
  });

  it('warns when a console would see nothing at all', async () => {
    mockPreview.mockResolvedValue({
      source_count: 1,
      stations: [{ station_aet: 'CT_09', rule_id: 2, rule_name: 'broken', mode: 'allow',
                   sources: [{ id: 1, name: 'ris-a', visible: false, effective_priority: 10 }],
                   reason: '' }],
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /compare|vergleichen/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/leere Arbeitsliste|empty worklist/i);
  });
});
