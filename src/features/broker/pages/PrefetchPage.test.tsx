import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PrefetchPage from './PrefetchPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { usePersistedUiStore, useSessionUiStore } from '@/store/ui-state';
import '@/i18n';

const { mockRun, mockListSubs, mockRemove, mockToast, mockRbac } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockListSubs: vi.fn(),
  mockRemove: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockRbac: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: mockRbac },
    targets: { list: vi.fn(() => Promise.resolve([
      { id: 1, name: 'pacs-main', aet: 'QR_AET', host: '10.0.0.1', port: 104 },
      { id: 2, name: 'dest', aet: 'DEST_AET', host: '10.0.0.2', port: 104 },
    ])) },
    prefetch: { run: mockRun },
    upsSubscriptions: { list: mockListSubs, remove: mockRemove, create: vi.fn() },
  },
}));

const PLAN = {
  dry_run: true,
  query_node: 'pacs-main',
  destination: 'dest',
  destination_aet: 'DEST_AET',
  studies: [
    { study_uid: '1.2.3', study_date: '20200101', description: 'CT Thorax',
      modalities: 'CT', instances: '120' },
  ],
  moved: [],
  skipped: [],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PrefetchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillForm() {
  // the PACS targets come from the API — the selects only get their options
  // once that answer is in (both selects carry the same names, so scope it)
  const nodeSelect = screen.getByLabelText(/where to look/i);
  await within(nodeSelect).findByRole('option', { name: 'pacs-main' });
  fireEvent.change(screen.getByLabelText(/patient id/i), { target: { value: 'P-100' } });
  fireEvent.change(nodeSelect, { target: { value: 'pacs-main' } });
  fireEvent.change(screen.getByLabelText(/where to deliver/i), { target: { value: 'dest' } });
}

describe('PrefetchPage', () => {
  beforeEach(() => {
    // the node/destination choices are persisted (non-PHI) — without clearing
    // them the previous test's selection would satisfy the "incomplete" check.
    // Both stores are module state, so localStorage alone is not enough.
    usePersistedUiStore.setState({ values: {} });
    useSessionUiStore.setState({ values: {} });
    window.localStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {},
    };
    loadConfig();
    mockRbac.mockResolvedValue({ mode: 'off', enforced: false, can_write: true,
                                 write_role: 'brokerWrite', roles_header: 'X-OE3-Roles',
                                 roles: [] });
    mockListSubs.mockResolvedValue([]);
    mockRun.mockResolvedValue(PLAN);
    mockRemove.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); window.localStorage.clear(); vi.clearAllMocks(); });

  it('asks before it moves anything: no fetch button until a preview ran', async () => {
    renderPage();
    await fillForm();

    // the destructive action is not offered yet — a DAU must not move images by
    // pressing the first button they see
    expect(screen.queryByRole('button', { name: /fetch/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockRun.mock.calls[0][1]).toBe(true);          // dry run first
    expect(await screen.findByText('CT Thorax')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fetch 1/i })).toBeInTheDocument();
  });

  it('keeps the fetch button disabled while the form is incomplete', async () => {
    renderPage();
    // only the patient ID — no nodes chosen
    fireEvent.change(screen.getByLabelText(/patient id/i), { target: { value: 'P-100' } });

    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled();
  });

  it('says that the preview moves nothing', async () => {
    renderPage();
    expect(await screen.findByText(/only asks the PACS what it knows/i)).toBeInTheDocument();
  });

  it('applies the prefetch with dry_run=false and reports the outcome', async () => {
    renderPage();
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await screen.findByText('CT Thorax');

    mockRun.mockResolvedValueOnce({
      ...PLAN, dry_run: false,
      moved: [{ study_uid: '1.2.3', status: 0, completed: 120, failed: 0, warning: 0,
                ok: true, error: '' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /fetch 1/i }));

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    expect(mockRun.mock.calls[1][1]).toBe(false);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    expect(await screen.findByTestId('prefetch-result')).toBeInTheDocument();
  });

  it('explains a read-only account instead of failing with a 403', async () => {
    mockRbac.mockResolvedValue({ mode: 'enforce', enforced: true, can_write: false,
                                 write_role: 'brokerWrite', roles_header: 'X-OE3-Roles',
                                 roles: ['brokerRead'] });
    renderPage();
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    await screen.findByText('CT Thorax');

    expect(screen.getByTestId('prefetch-readonly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fetch 1/i })).toBeDisabled();
  });

  it('lists the work item subscriptions and removes one after confirming', async () => {
    mockListSubs.mockResolvedValue([
      { id: 1, subscriber_aet: 'CT_01', workitem_uid: '', deletion_lock: false,
        created_at: '2026-09-30T10:00:00Z' },
    ]);
    renderPage();

    const card = await screen.findByTestId('prefetch-subscriptions');
    expect(await within(card).findByText('CT_01')).toBeInTheDocument();
    expect(within(card).getByText(/all work items/i)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('CT_01'));
  });
});
