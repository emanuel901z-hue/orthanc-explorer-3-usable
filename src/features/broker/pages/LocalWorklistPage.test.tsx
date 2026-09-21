import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LocalWorklistPage from './LocalWorklistPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import { mockMobileViewport, resetViewport } from '@/test/viewport';
import '@/i18n';

const { mockList, mockCreate, mockUpdate, mockRemove, mockOrm, mockMessages } = vi.hoisted(() => ({
  mockList: vi.fn(), mockCreate: vi.fn(), mockUpdate: vi.fn(),
  mockRemove: vi.fn(), mockOrm: vi.fn(), mockMessages: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    localItems: { list: mockList, create: mockCreate, update: mockUpdate, remove: mockRemove },
    hl7: { orm: mockOrm, messages: mockMessages },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

const ITEM = {
  id: 1, accession: 'EMERG-001', sps_id: '1', patient_id: 'P9001',
  patient_name: 'Notfall^Anna', birth_date: '1990-01-01', sex: 'F', modality: 'CT',
  station_aet: 'CT_01', procedure_description: 'CT Schädel', scheduled_date: '2026-09-17',
  scheduled_time: '12:00', study_uid: '', sps_status: 'SCHEDULED',
  valid_until: '2026-09-24T00:00:00', enabled: true, origin: 'manual',
  created_at: '2026-09-17T10:00:00', updated_at: '2026-09-17T10:00:00',
};

const PARSE = {
  dry_run: true, message_type: 'ORM^O01', control_id: 'MSG0001', order_control: 'NW',
  accession: 'ACC-HL7-1', action: 'created-or-updated', item: null,
  parsed: { accession: 'ACC-HL7-1', patient_id: 'P1001', modality: 'CT', warnings: [] },
  warnings: [],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><LocalWorklistPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LocalWorklistPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockList.mockResolvedValue([ITEM]);
    mockMessages.mockResolvedValue([
      { id: 1, ts: '2026-09-17T10:00:00', transport: 'mllp', message_type: 'ORM^O01',
        control_id: 'C1', order_control: 'NW', accession: 'ACC-HL7-1', action: 'created', error: '' },
    ]);
    mockCreate.mockResolvedValue(ITEM);
    mockUpdate.mockResolvedValue(ITEM);
    mockRemove.mockResolvedValue(undefined);
    mockOrm.mockResolvedValue(PARSE);
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); resetViewport(); vi.clearAllMocks(); });

  it('lists the local items with their scheduling data', async () => {
    renderPage();

    expect(await screen.findByText('EMERG-001')).toBeInTheDocument();
    expect(screen.getByText('Notfall^Anna')).toBeInTheDocument();
    expect(screen.getByText('CT Schädel')).toBeInTheDocument();
    expect(screen.getAllByText('CT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2026-09-24')).toBeInTheDocument();
  });

  it('reports an empty list', async () => {
    mockList.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no local items yet/i)).toBeInTheDocument();
  });

  it('creates an item and audits it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(screen.getByLabelText(/accession/i), { target: { value: 'EMERG-002' } });
    fireEvent.change(screen.getByLabelText(/patient name/i), { target: { value: 'Neu^Max' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      accession: 'EMERG-002', patient_name: 'Neu^Max',
    });
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.local_item.create', outcome: 'started',
    });
  });

  it('edits an existing item', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/procedure/i), {
      target: { value: 'CT Schädel nativ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    // the client takes (id, body)
    expect(mockUpdate.mock.calls[0][0]).toBe(1);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      procedure_description: 'CT Schädel nativ',
    });
  });

  it('deletes an item only after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    expect(mockRemove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(1));
  });

  it('checks an HL7 message without writing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /check \(dry-run\)/i }));

    await waitFor(() => expect(mockOrm).toHaveBeenCalled());
    expect(mockOrm.mock.calls[0][1]).toBe(true);
    const result = await screen.findByTestId('broker-hl7-result');
    expect(result).toHaveTextContent(/dry-run/i);
    expect(result).toHaveTextContent('ACC-HL7-1');
    expect(result).toHaveTextContent('ORM^O01');
  });

  it('applies an HL7 message', async () => {
    mockOrm.mockResolvedValue({ ...PARSE, dry_run: false, action: 'created' });
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => expect(mockOrm).toHaveBeenCalled());
    expect(mockOrm.mock.calls[0][1]).toBe(false);
    expect(await screen.findByTestId('broker-hl7-result')).toHaveTextContent(/applied/i);
  });

  it('shows parser warnings', async () => {
    mockOrm.mockResolvedValue({ ...PARSE, warnings: ['no scheduled start (OBR-6/OBR-27)'] });
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /check \(dry-run\)/i }));

    expect(await screen.findByText(/no scheduled start/i)).toBeInTheDocument();
  });

  it('lists the recent HL7 messages', async () => {
    renderPage();

    const list = await screen.findByTestId('broker-hl7-messages');
    // the list arrives with the query
    await within(list).findByText('mllp');
    expect(within(list).getByText('mllp')).toBeInTheDocument();
    expect(within(list).getByText('ACC-HL7-1')).toBeInTheDocument();
    expect(within(list).getByText('created')).toBeInTheDocument();
  });

  it('keeps the dialog scrollable on a small screen', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    const dialog = await screen.findByRole('dialog');

    // a 13-field form must not overflow a phone viewport without scrolling
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.className).toContain('overflow-y-auto');
  });

  it('renders the mobile card layout', async () => {
    mockMobileViewport();
    renderPage();
    await waitFor(() => expect(screen.getByText('EMERG-001')).toBeInTheDocument());

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Valid until')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });
});
