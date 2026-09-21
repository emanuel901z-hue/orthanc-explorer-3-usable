/**
 * HL7 field mappings: local conventions (room in OBR-18) without a code change.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { Hl7MappingCard } from './Hl7MappingCard';
import '@/i18n';

const { mockList, mockCreate, mockRemove } = vi.hoisted(() => ({
  mockList: vi.fn(), mockCreate: vi.fn(), mockRemove: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    hl7FieldMaps: { list: mockList, create: mockCreate, remove: mockRemove },
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true,
                                                  write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
  },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><Hl7MappingCard /></MemoryRouter></QueryClientProvider>,
  );
}

describe('Hl7MappingCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockList.mockResolvedValue([
      { id: 1, segment: 'OBR', field: 18, component: 2, target_tag: 'ScheduledProcedureStepLocation',
        enabled: true, created_at: '' },
    ]);
    mockCreate.mockResolvedValue({ id: 2, segment: 'ZDS', field: 3, component: 0,
                                   target_tag: 'RequestedContrastAgent', enabled: true, created_at: '' });
    mockRemove.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows a mapping as HL7 location → DICOM attribute', async () => {
    renderCard();

    const list = await screen.findByTestId('hl7-mapping-list');
    expect(within(list).getByText('OBR-18.2')).toBeInTheDocument();
    expect(within(list).getByText('ScheduledProcedureStepLocation')).toBeInTheDocument();
  });

  it('explains that only the standard fields are read without a mapping', async () => {
    mockList.mockResolvedValue([]);
    renderCard();

    expect(await screen.findByText(/only the standard fields|nur die Standardfelder/i)).toBeInTheDocument();
  });

  it('creates a mapping with segment, field, component and attribute', async () => {
    renderCard();
    await screen.findByTestId('hl7-mapping-list');

    fireEvent.change(screen.getByLabelText(/^segment$/i), { target: { value: 'zds' } });
    fireEvent.change(screen.getByLabelText(/^field$/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^component$/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/dicom attribute|dicom-feld/i),
                     { target: { value: 'RequestedContrastAgent' } });
    fireEvent.click(screen.getByRole('button', { name: /add mapping|zuordnung anlegen/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        segment: 'ZDS', field: 3, component: 0, target_tag: 'RequestedContrastAgent',
      });
    });
  });

  it('keeps the button disabled while the input is incomplete', async () => {
    renderCard();
    await screen.findByTestId('hl7-mapping-list');

    const button = screen.getByRole('button', { name: /add mapping|zuordnung anlegen/i });
    expect(button).toBeDisabled();                       // no attribute yet
    fireEvent.change(screen.getByLabelText(/dicom attribute|dicom-feld/i), { target: { value: 'PatientID' } });
    expect(button).toBeEnabled();
  });

  it('shows the server message when the attribute is not a DICOM keyword', async () => {
    mockCreate.mockRejectedValue(new Error("'NotATag' is not a DICOM attribute name"));
    renderCard();
    await screen.findByTestId('hl7-mapping-list');

    fireEvent.change(screen.getByLabelText(/dicom attribute|dicom-feld/i), { target: { value: 'NotATag' } });
    fireEvent.click(screen.getByRole('button', { name: /add mapping|zuordnung anlegen/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a DICOM attribute/i);
  });

  it('deletes a mapping', async () => {
    renderCard();
    await screen.findByTestId('hl7-mapping-list');

    fireEvent.click(screen.getByRole('button', { name: /delete mapping OBR-18|löschen/i }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(1));
  });
});
