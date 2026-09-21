import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SourcesPage from './SourcesPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';
import { mockMobileViewport, resetViewport } from '@/test/viewport';

const { mockList, mockCreate, mockUpdate, mockDelete, mockStatus, mockResetBreaker } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockStatus: vi.fn(),
  mockResetBreaker: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    status: mockStatus,
    sources: {
      list: mockList, create: mockCreate, update: mockUpdate, delete: mockDelete,
      echo: vi.fn(() => Promise.resolve({ ok: true })),
      resetBreaker: mockResetBreaker,
    },
    targets: {
      list: vi.fn(() => Promise.resolve([])), create: vi.fn(), update: vi.fn(),
      delete: vi.fn(), echo: vi.fn(() => Promise.resolve({ ok: true })),
    },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    transforms: { list: vi.fn(() => Promise.resolve([])) },
    settings: { list: vi.fn(() => Promise.resolve([])) },
    logs: { queries: vi.fn(() => Promise.resolve([])), stores: vi.fn(() => Promise.resolve([])) },
  },
}));

const SOURCE_ROW = {
  id: 1, name: 'ris-a', aet: 'RIS_A', host: 'ris.local', port: 11114,
  calling_aet: 'MWLBROKER', charset: 'ISO_IR 100', enabled: true,
  timeout_s: 10, priority: 10, created_at: '2026-09-16T10:00:00Z',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SourcesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SourcesPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {},
    };
    loadConfig();
    mockList.mockResolvedValue([SOURCE_ROW]);
    mockStatus.mockResolvedValue({
      scp_listening: true, db_ok: true, sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    });
    mockCreate.mockResolvedValue({ id: 2 });
    mockUpdate.mockResolvedValue({ id: 1 });
    mockDelete.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); resetViewport(); vi.clearAllMocks(); });

  it('lists sources with their DICOM endpoint and charset', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('RIS_A@ris.local:11114')).toBeInTheDocument());
    expect(screen.getByText('ISO_IR 100')).toBeInTheDocument();
    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('creates a source through the dialog', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ris-b' } });
    fireEvent.change(screen.getByLabelText('AE title'), { target: { value: 'RIS_B' } });
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'ris-b.local' } });
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '11115' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'ris-b', aet: 'RIS_B', host: 'ris-b.local', port: 11115, enabled: true,
    });
  });

  it('does not submit an invalid form (missing host)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ris-b' } });
    fireEvent.change(screen.getByLabelText('AE title'), { target: { value: 'RIS_B' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('edits an existing source (prefilled dialog)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit source/i }));
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('ris-a');
    fireEvent.change(nameInput, { target: { value: 'ris-a2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toBe(1);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ name: 'ris-a2' });
  });

  it('shows the server error when the create is rejected', async () => {
    mockCreate.mockRejectedValue(new Error('ris-b already exists'));
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ris-b' } });
    fireEvent.change(screen.getByLabelText('AE title'), { target: { value: 'RIS_B' } });
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'ris-b.local' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ris-b already exists');
  });

  it('renders the mobile card layout with all fields', async () => {
    mockMobileViewport();
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    // the card shows label/value pairs instead of table columns
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('RIS_A@ris.local:11114')).toBeInTheDocument();
    expect(screen.getByText('ISO_IR 100')).toBeInTheDocument();
    expect(screen.getByText('10s')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // actions stay reachable
    expect(screen.getByRole('button', { name: /edit source/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete source/i })).toBeInTheDocument();
  });

  it('shows the circuit breaker and resets it', async () => {
    mockStatus.mockResolvedValue({
      scp_listening: true, db_ok: true, targets: [],
      sources: [{
        kind: 'source', id: 1, name: 'ris-a', ok: false, rtt_ms: null,
        last_check: '2026-09-16T10:00:00Z', error: 'connection refused',
        breaker_state: 'open', breaker_retry_in_s: 42,
      }],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    });
    mockResetBreaker.mockResolvedValue({ source_id: 1, name: 'ris-a', state: 'closed' });

    renderPage();
    await waitFor(() => expect(screen.getByText(/breaker open/i)).toBeInTheDocument());
    expect(screen.getByText(/42/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset circuit breaker/i }));
    await waitFor(() => expect(mockResetBreaker).toHaveBeenCalledWith(1));
  });

  it('sends the cache settings of the source dialog', async () => {
    mockCreate.mockResolvedValue({ id: 2 });
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'ris-c' } });
    fireEvent.change(screen.getByLabelText(/^ae ?title$/i), { target: { value: 'RIS_C' } });
    fireEvent.change(screen.getByLabelText(/^host$/i), { target: { value: 'h' } });
    fireEvent.change(screen.getByLabelText(/^port$/i), { target: { value: '104' } });

    // the cache group is only offered for sources
    expect(screen.getByText(/worklist cache/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /serve from cache/i }));
    fireEvent.change(screen.getByLabelText(/background refresh/i), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'ris-c', cache_stale_on_error: false, cache_refresh_s: 300,
    });
  });

  it('deletes a source only after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /delete source/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    // the operator sees that dependent rules are removed as well
    expect(screen.getByText(/routing rules, modify rules and worklist history/i)).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });
});
