/**
 * The preview answers "what would this console receive?" — with provenance,
 * PHI-free by default.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { WorklistPreviewPanel } from './WorklistPreviewPanel';
import '@/i18n';

const { mockPreview } = vi.hoisted(() => ({ mockPreview: vi.fn() }));
vi.mock('@/api/broker', () => ({
  brokerApi: {
    worklistPreview: mockPreview,
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'b', roles_header: 'X', roles: [] })) },
  },
}));

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><WorklistPreviewPanel /></MemoryRouter></QueryClientProvider>,
  );
}

describe('WorklistPreviewPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows the merged items with their source and the per-source contribution', async () => {
    mockPreview.mockResolvedValue({
      station: 'CT_01', rule: 'ct-rule', status: 'partial', duration_ms: 210,
      answers: 1, hidden: 2, phi: false, served_stale: ['ris-b'],
      sources: [
        { name: 'ris-a', source_id: 1, answers: 1, stale: false, breaker_state: null },
        { name: 'ris-b', source_id: 2, answers: 0, stale: true, breaker_state: null },
        { name: 'ris-c', source_id: 3, answers: 'breaker_open', stale: false, breaker_state: 'open' },
      ],
      items: [{
        accession: 'ACC-A-001', study_uid: '1.2.3', requested_procedure_id: '', sps_id: '1',
        station_aet: 'CT_01', modality: 'CT', start_date: '20260921', start_time: '',
        source: 'ris-a', also_in: ['ris-b'],
      }],
      truncated: false,
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /run preview|vorschau starten/i }));

    const result = await screen.findByTestId('preview-result');
    await waitFor(() => expect(result.textContent).toContain('ACC-A-001'));
    expect(result.textContent).toContain('ris-a');
    expect(result.textContent).toContain('ct-rule');
    // hidden items and the stale source are visible
    expect(result.textContent).toContain('2');
    expect(mockPreview).toHaveBeenCalledWith({});
  });

  it('flags a preview that includes patient names', async () => {
    mockPreview.mockResolvedValue({
      station: '', rule: null, status: 'success', duration_ms: 10, answers: 1, hidden: 0,
      phi: true, served_stale: [], sources: [],
      items: [{ accession: 'ACC-1', study_uid: '', requested_procedure_id: '', sps_id: '',
                station_aet: '', modality: 'CT', start_date: '', start_time: '',
                source: 'ris-a', also_in: [], patient_name: 'Muster^Max', patient_id: 'P1' }],
      truncated: false,
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /run preview|vorschau starten/i }));

    expect(await screen.findByTestId('preview-phi')).toBeInTheDocument();
  });

  it('passes the station and the accession to the API', async () => {
    mockPreview.mockResolvedValue({
      station: 'MR_01', rule: null, status: 'success', duration_ms: 5, answers: 0, hidden: 0,
      phi: false, served_stale: [], sources: [], items: [], truncated: false,
    });

    renderPanel();
    fireEvent.change(screen.getByLabelText(/station aet|station-aet/i), { target: { value: 'mr_01' } });
    fireEvent.change(screen.getByLabelText(/accession|zugangsnummer/i), { target: { value: 'ACC-9' } });
    fireEvent.click(screen.getByRole('button', { name: /run preview|vorschau starten/i }));

    await waitFor(() => {
      expect(mockPreview).toHaveBeenCalledWith({ station_aet: 'MR_01', accession: 'ACC-9' });
    });
  });
});
