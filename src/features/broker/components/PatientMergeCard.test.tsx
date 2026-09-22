/**
 * IHE PIR card: record a merge or a link, check an ID, undo it.
 *
 * A merge retires the old identifier, a link does not — the card has to make
 * that visible, otherwise an operator would "link" two records believing it
 * merges them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { PatientMergeCard } from './PatientMergeCard';
import '@/i18n';

const { mockList, mockCreate, mockRemove, mockResolve } = vi.hoisted(() => ({
  mockList: vi.fn(), mockCreate: vi.fn(), mockRemove: vi.fn(), mockResolve: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    patientMerges: { list: mockList, create: mockCreate, remove: mockRemove, resolve: mockResolve },
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true,
                                                  write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
  },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><PatientMergeCard /></MemoryRouter></QueryClientProvider>,
  );
}

const MERGE = { id: 1, ts: '2026-09-22T10:00:00Z', old_patient_id: 'ALT-4711',
                new_patient_id: '12345', reason: 'Notfall', actor: 'adt',
                origin: 'adt', kind: 'merge' as const, active: true };

const LINK = { id: 2, ts: '2026-09-22T10:05:00Z', old_patient_id: 'ZWEITE-MRN',
               new_patient_id: '12345', reason: '', actor: 'adt', origin: 'adt',
               kind: 'link' as const, active: true };

describe('PatientMergeCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockList.mockResolvedValue([MERGE]);
    mockCreate.mockResolvedValue(MERGE);
    mockRemove.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('lists the recorded merges with their origin', async () => {
    renderCard();

    const list = await screen.findByTestId('merge-list');
    expect(list.textContent).toContain('ALT-4711');
    expect(list.textContent).toContain('12345');
    expect(list.textContent).toMatch(/ADT|RIS/);
  });

  it('records a merge and clears the form', async () => {
    renderCard();
    await screen.findByTestId('merge-list');

    fireEvent.change(screen.getByLabelText(/alte id|old id/i), { target: { value: 'A-1' } });
    fireEvent.change(screen.getByLabelText(/aktuelle id|current id/i), { target: { value: 'B-2' } });
    fireEvent.click(screen.getByRole('button', { name: /^(eintragen|record)$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
      { old_patient_id: 'A-1', new_patient_id: 'B-2', kind: 'merge', reason: '' }));
  });

  it('resolves an identifier the modality sends', async () => {
    mockResolve.mockResolvedValue({ patient_id: 'ALT-4711', resolved: '12345', merged: true });
    renderCard();
    await screen.findByTestId('merge-list');

    fireEvent.change(screen.getByLabelText(/id prüfen|check an id/i),
                     { target: { value: 'ALT-4711' } });
    fireEvent.click(screen.getByRole('button', { name: /auflösen|resolve/i }));

    const result = await screen.findByTestId('merge-probe-result');
    expect(result.textContent).toContain('12345');
  });

  it('marks a link as a link, not as a merge', async () => {
    mockList.mockResolvedValue([MERGE, LINK]);
    renderCard();
    await screen.findByTestId('merge-list');

    expect(screen.getByTestId('merge-kind-1').textContent).toMatch(/merge|zusammenführen/i);
    expect(screen.getByTestId('merge-kind-2').textContent).toMatch(/link|verknüpfen/i);
  });

  it('says so when nothing is recorded', async () => {
    mockList.mockResolvedValue([]);
    renderCard();

    expect(await screen.findByText(/nichts eingetragen|nothing recorded/i)).toBeInTheDocument();
  });

  it('explains that an unchanged ID stays as it is', async () => {
    mockResolve.mockResolvedValue({ patient_id: 'X', resolved: 'X', merged: false });
    renderCard();
    await screen.findByTestId('merge-list');

    fireEvent.change(screen.getByLabelText(/id prüfen|check an id/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /auflösen|resolve/i }));

    const result = await screen.findByTestId('merge-probe-result');
    expect(result.textContent).toMatch(/unverändert|unchanged/i);
  });
});
