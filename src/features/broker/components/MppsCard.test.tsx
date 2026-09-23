/**
 * The MPPS card shows what the modalities reported and whether the RIS got it —
 * the counterpart of the worklist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { MppsCard } from './MppsCard';
import '@/i18n';

const { mockStats, mockList, mockForwardPending, mockForwardOne } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockList: vi.fn(),
  mockForwardPending: vi.fn(),
  mockForwardOne: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    mpps: { stats: mockStats, list: mockList, forwardPending: mockForwardPending,
            forward: mockForwardOne },
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true,
                                                  write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
  },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><MppsCard /></MemoryRouter></QueryClientProvider>,
  );
}

const STATS = {
  total: 4, by_status: { COMPLETED: 3, 'IN PROGRESS': 1 }, forwarded: 2,
  pending_forward: 1, last_error: '', forward_enabled: true, hide_completed: true,
};

describe('MppsCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStats.mockResolvedValue(STATS);
    mockList.mockResolvedValue([
      { id: 1, ts: '2026-09-21T10:15:30Z', sop_instance_uid: '1.2.3', status: 'COMPLETED',
        accession: 'ACC-1', patient_id: 'P-1', sps_id: '1', station_aet: 'CT_01',
        modality: 'CT', study_uid: '1.2.3.4', performed_procedure_step_id: 'PPS-1',
        started_at: null, ended_at: null, forwarded: true, forward_error: '',
        forward_attempts: 1, forwarded_at: null },
      { id: 2, ts: '2026-09-21T10:20:00Z', sop_instance_uid: '1.2.4', status: 'COMPLETED',
        accession: 'ACC-2', patient_id: 'P-2', sps_id: '2', station_aet: 'MR_01',
        modality: 'MR', study_uid: '1.2.4.5', performed_procedure_step_id: 'PPS-2',
        started_at: null, ended_at: null, forwarded: false,
        forward_error: 'connection refused', forward_attempts: 2, forwarded_at: null },
    ]);
    mockForwardPending.mockResolvedValue({ attempted: 1, sent: 1, failed: 0 });
    mockForwardOne.mockResolvedValue({ ok: true, error: '' });
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows how many steps arrived and how many are still pending', async () => {
    renderCard();

    const card = await screen.findByTestId('broker-mpps');
    await waitFor(() => expect(card.textContent).toContain('4'));
    expect(card.textContent).toMatch(/1 noch nicht gemeldet|1 not reported yet/);
  });

  it('lists the steps with their status and the delivery result', async () => {
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /steps anzeigen|show steps/i }));

    const table = await screen.findByRole('table');
    await waitFor(() => expect(within(table).getByText('ACC-1')).toBeInTheDocument());
    expect(within(table).getByText('ACC-2')).toBeInTheDocument();
    // the failed delivery is visible, not hidden
    expect(within(table).getByText(/connection refused/)).toBeInTheDocument();
  });

  it('offers to report the pending steps again', async () => {
    renderCard();
    const button = await screen.findByRole('button', { name: /erneut melden|again/i });

    fireEvent.click(button);

    await waitFor(() => expect(mockForwardPending).toHaveBeenCalled());
  });

  it('does not offer the retry when nothing is pending', async () => {
    mockStats.mockResolvedValue({ ...STATS, pending_forward: 0 });
    renderCard();

    await screen.findByTestId('broker-mpps');
    await waitFor(() => expect(
      screen.queryByRole('button', { name: /erneut melden|again/i })).toBeNull());
  });

  it('meldet genau den nicht zugestellten Schritt erneut', async () => {
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /steps anzeigen|show steps/i }));
    const table = await screen.findByRole('table');
    await waitFor(() => expect(within(table).getByText('ACC-1')).toBeInTheDocument());

    // zugestellter Schritt: kein Knopf · nicht zugestellter Schritt: Knopf
    const delivered = within(table).getByText('ACC-1').closest('tr') as HTMLElement;
    const pending = within(table).getByText('ACC-2').closest('tr') as HTMLElement;
    expect(within(delivered).queryByRole('button', { name: /send again|erneut senden/i })).toBeNull();

    fireEvent.click(within(pending).getByRole('button', { name: /send again|erneut senden/i }));
    await waitFor(() => expect(mockForwardOne).toHaveBeenCalledWith(2));
  });
});
