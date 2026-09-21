/**
 * Field-level merge rules: which source wins for a single DICOM attribute.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { MergeRulesCard } from './MergeRulesCard';
import '@/i18n';

const { mockList, mockCreate, mockRemove, mockSources } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockRemove: vi.fn(),
  mockSources: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    mergeRules: { list: mockList, create: mockCreate, remove: mockRemove },
    sources: { list: mockSources },
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true,
                                                  write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
  },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><MergeRulesCard /></MemoryRouter></QueryClientProvider>,
  );
}

describe('MergeRulesCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockList.mockResolvedValue([
      { id: 1, tag: 'PatientName', sources: ['his-feed', 'ris-a'], enabled: true, created_at: '' },
    ]);
    mockSources.mockResolvedValue([
      { id: 1, name: 'his-feed' }, { id: 2, name: 'ris-a' },
    ]);
    mockCreate.mockResolvedValue({ id: 2, tag: 'StudyDescription', sources: ['ris-a'], enabled: true, created_at: '' });
    mockRemove.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows the rules with the source order', async () => {
    renderCard();

    const list = await screen.findByTestId('merge-rules-list');
    expect(within(list).getByText('PatientName')).toBeInTheDocument();
    // the order is visible: first source wins
    expect(within(list).getByText('1. his-feed')).toBeInTheDocument();
    expect(within(list).getByText('2. ris-a')).toBeInTheDocument();
  });

  it('explains the default when no rule exists', async () => {
    mockList.mockResolvedValue([]);
    renderCard();

    expect(await screen.findByText(/normal merge|normale Merge/i)).toBeInTheDocument();
  });

  it('creates a rule with the parsed source list', async () => {
    renderCard();
    await screen.findByTestId('merge-rules-list');

    fireEvent.change(screen.getByLabelText(/dicom attribute|dicom-feld/i), { target: { value: 'PatientID' } });
    fireEvent.change(screen.getByLabelText(/sources \(in order\)|quellen \(in reihenfolge\)/i),
                     { target: { value: 'his-feed, ris-a' } });
    fireEvent.click(screen.getByRole('button', { name: /add field rule|feldregel anlegen/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ tag: 'PatientID', sources: ['his-feed', 'ris-a'] });
    });
  });

  it('keeps the button disabled until a tag and a source are given', async () => {
    renderCard();
    await screen.findByTestId('merge-rules-list');

    const button = screen.getByRole('button', { name: /add field rule|feldregel anlegen/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/dicom attribute|dicom-feld/i), { target: { value: 'PatientID' } });
    expect(button).toBeDisabled();          // still no source
    fireEvent.change(screen.getByLabelText(/sources \(in order\)|quellen \(in reihenfolge\)/i),
                     { target: { value: 'ris-a' } });
    expect(button).toBeEnabled();
  });

  it('deletes a rule', async () => {
    renderCard();
    await screen.findByTestId('merge-rules-list');

    fireEvent.click(screen.getByRole('button', { name: /delete rule for PatientName|regel für PatientName löschen/i }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(1));
  });

  it('shows the server message when a tag or source is refused', async () => {
    mockCreate.mockRejectedValue(new Error("'NotATag' is not a DICOM attribute name"));
    renderCard();
    await screen.findByTestId('merge-rules-list');

    fireEvent.change(screen.getByLabelText(/dicom attribute|dicom-feld/i), { target: { value: 'NotATag' } });
    fireEvent.change(screen.getByLabelText(/sources \(in order\)|quellen \(in reihenfolge\)/i),
                     { target: { value: 'ris-a' } });
    fireEvent.click(screen.getByRole('button', { name: /add field rule|feldregel anlegen/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a DICOM attribute/i);
  });
});
