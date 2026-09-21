import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TransformsPage from './TransformsPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';
import { mockMobileViewport, resetViewport } from '@/test/viewport';

const { mockList, mockCreate, mockUpdate, mockDelete, mockSources } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSources: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    status: vi.fn(() => Promise.resolve({
      scp_listening: true, db_ok: true, sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    })),
    sources: { list: mockSources, echo: vi.fn() },
    targets: { list: vi.fn(() => Promise.resolve([])), echo: vi.fn() },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    transforms: { list: mockList, create: mockCreate, update: mockUpdate, delete: mockDelete },
    settings: { list: vi.fn(() => Promise.resolve([])) },
    logs: { queries: vi.fn(() => Promise.resolve([])), stores: vi.fn(() => Promise.resolve([])) },
  },
}));

const RULE = {
  id: 1,
  name: 'kh-prefix',
  enabled: true,
  priority: 10,
  source_id: 10,
  target_id: null,
  operations: [
    { op: 'prefix' as const, tag: 'PatientID', value: 'KH_' },
    { op: 'remove' as const, tag: 'PatientAddress' },
  ],
  created_at: '2026-09-16T10:00:00Z',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TransformsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TransformsPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {},
    };
    loadConfig();
    mockList.mockResolvedValue([RULE]);
    mockSources.mockResolvedValue([
      { id: 10, name: 'ris-a', aet: 'RIS_A', host: 'h', port: 1, calling_aet: 'C',
        charset: 'ISO_IR 100', enabled: true, timeout_s: 10, priority: 10, created_at: '' },
    ]);
    mockCreate.mockResolvedValue({ id: 2 });
    mockUpdate.mockResolvedValue({ id: 1 });
    mockDelete.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); resetViewport(); vi.clearAllMocks(); });

  it('shows the operations and the resolved scope', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());
    expect(screen.getByText('prefix PatientID')).toBeInTheDocument();
    expect(screen.getByText('remove PatientAddress')).toBeInTheDocument();
    expect(screen.getByText('ris-a')).toBeInTheDocument();
    expect(screen.getByText(/any target/i)).toBeInTheDocument();
  });

  it('creates a rule with an operation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add modify rule/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'institution' } });
    fireEvent.change(screen.getByLabelText('DICOM tag'), {
      target: { value: 'InstitutionName' },
    });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'Klinikum' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const body = mockCreate.mock.calls[0][0];
    expect(body.name).toBe('institution');
    expect(body.operations).toEqual([
      { op: 'set', tag: 'InstitutionName', value: 'Klinikum' },
    ]);
    expect(body.source_id).toBeNull();
  });

  it('adds and removes operations in the editor', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add modify rule/i }));
    expect(screen.getByText('Operation 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add operation/i }));
    expect(screen.getByText('Operation 2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /remove operation/i })[1]);
    expect(screen.queryByText('Operation 2')).not.toBeInTheDocument();
  });

  it('renders the mobile card layout with scope and operations', async () => {
    mockMobileViewport();
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());

    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('prefix PatientID, remove PatientAddress')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('toggles a rule through the switch', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toBe(1);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ enabled: false, name: 'kh-prefix' });
    expect(mockUpdate.mock.calls[0][1].operations).toHaveLength(2);
  });

  it('edits a rule through the prefilled dialog', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit modify rule/i }));
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('kh-prefix');
    fireEvent.change(name, { target: { value: 'kh-prefix-2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ name: 'kh-prefix-2' });
  });

  it('deletes a rule after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('kh-prefix')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /delete modify rule/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });
});
