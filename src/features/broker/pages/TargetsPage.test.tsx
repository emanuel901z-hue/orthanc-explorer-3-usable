import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TargetsPage from './TargetsPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';
import { mockMobileViewport, resetViewport } from '@/test/viewport';

const { mockList, mockCreate, mockUpdate, mockDelete, mockStatus } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockStatus: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    status: mockStatus,
    sources: { list: vi.fn(() => Promise.resolve([])), echo: vi.fn(() => Promise.resolve({})) },
    targets: {
      list: mockList, create: mockCreate, update: mockUpdate, delete: mockDelete,
      echo: vi.fn(() => Promise.resolve({ ok: true })),
    },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    transforms: { list: vi.fn(() => Promise.resolve([])) },
    settings: { list: vi.fn(() => Promise.resolve([])) },
    logs: { queries: vi.fn(() => Promise.resolve([])), stores: vi.fn(() => Promise.resolve([])) },
  },
}));

const TARGET_ROW = {
  id: 1, name: 'pacs-kh', aet: 'PACS_KH', host: 'pacs.local', port: 104,
  calling_aet: 'MWLBROKER', enabled: true, is_default: true,
  created_at: '2026-09-16T10:00:00Z',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TargetsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TargetsPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {},
    };
    loadConfig();
    mockList.mockResolvedValue([TARGET_ROW]);
    mockStatus.mockResolvedValue({
      scp_listening: true, db_ok: true, sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    });
    mockCreate.mockResolvedValue({ id: 2 });
    mockUpdate.mockResolvedValue({ id: 1 });
    mockDelete.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); resetViewport(); vi.clearAllMocks(); });

  it('lists targets, marking the default destination', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('PACS_KH@pacs.local:104')).toBeInTheDocument());
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('renders the mobile card layout', async () => {
    mockMobileViewport();
    renderPage();
    await waitFor(() => expect(screen.getByText('pacs-kh')).toBeInTheDocument());

    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('PACS_KH@pacs.local:104')).toBeInTheDocument();
    expect(screen.getByText('MWLBROKER')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('creates a target including the default flag', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('pacs-kh')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add target/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pacs-alt' } });
    fireEvent.change(screen.getByLabelText('AE title'), { target: { value: 'PACS_ALT' } });
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'alt.local' } });
    fireEvent.click(screen.getByLabelText('default'));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'pacs-alt', aet: 'PACS_ALT', host: 'alt.local', is_default: true,
    });
  });

  it('deletes a target after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('pacs-kh')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /delete target/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });
});
