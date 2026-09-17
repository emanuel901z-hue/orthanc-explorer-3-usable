import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BrokerSettingsPage from './BrokerSettingsPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockList, mockSet, mockReset } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSet: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    status: vi.fn(() => Promise.resolve({
      scp_listening: true, db_ok: true, sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    })),
    sources: { list: vi.fn(() => Promise.resolve([])), echo: vi.fn() },
    targets: { list: vi.fn(() => Promise.resolve([])), echo: vi.fn() },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    transforms: { list: vi.fn(() => Promise.resolve([])) },
    settings: { list: mockList, set: mockSet, reset: mockReset },
    atna: {
      stats: vi.fn(() => Promise.resolve({
        enabled: false, configured: false, host: '', port: 6514, protocol: 'tcp',
        queue_size: 0, queue_max: 10000, worker_running: false,
      })),
      test: vi.fn(() => Promise.resolve({ ok: false, error: 'not configured' })),
      sample: vi.fn(() => Promise.resolve({ xml: '<AuditMessage/>' })),
    },
    notify: {
      events: vi.fn(() => Promise.resolve([
        { code: 'source_down', severity: 'error', description: 'A source stopped answering.' },
      ])),
      test: vi.fn(() => Promise.resolve({ ok: true, error: '' })),
    },
    logs: { queries: vi.fn(() => Promise.resolve([])), stores: vi.fn(() => Promise.resolve([])) },
  },
}));

const SETTINGS = [
  {
    key: 'strict_store_status', value: 'true', default: 'true', source: 'env' as const,
    kind: 'bool' as const, description: 'Report a DIMSE failure to the modality when forwarding fails.',
  },
  {
    key: 'allowed_calling_aets', value: 'CT_01', default: '', source: 'db' as const,
    kind: 'aets' as const, description: 'Comma-separated calling AE titles allowed to query/store.',
  },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BrokerSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BrokerSettingsPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {},
    };
    loadConfig();
    mockList.mockResolvedValue(SETTINGS);
    mockSet.mockResolvedValue({ key: 'strict_store_status', value: 'false', source: 'db' });
    mockReset.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows source badge and the ENV default for each setting', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Allowed calling AE titles')).toBeInTheDocument());

    // scoped: the alerting card renders its own badges
    const envRow = within(screen.getByTestId('setting-strict_store_status'));
    expect(envRow.getByText('from .env')).toBeInTheDocument();

    const overrideRow = within(screen.getByTestId('setting-allowed_calling_aets'));
    expect(overrideRow.getByText('override')).toBeInTheDocument();
    expect(overrideRow.getByText('—')).toBeInTheDocument();   // ENV default is empty
  });

  it('toggles a boolean setting through the switch', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Strict store status')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('switch')[0]);

    await waitFor(() => expect(mockSet).toHaveBeenCalledTimes(1));
    expect(mockSet.mock.calls[0]).toEqual(['strict_store_status', 'false']);
  });

  it('saves a text setting only when changed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Allowed calling AE titles')).toBeInTheDocument());

    const row = within(screen.getByTestId('setting-allowed_calling_aets'));
    const input = row.getByLabelText('Allowed calling AE titles') as HTMLInputElement;
    expect(input.value).toBe('CT_01');
    const saveButton = row.getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'CT_01,MR_01' } });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith('allowed_calling_aets', 'CT_01,MR_01'),
    );
  });

  it('resets an override back to the ENV default', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Allowed calling AE titles')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }));
    await waitFor(() => expect(mockReset).toHaveBeenCalledWith('allowed_calling_aets'));
  });
});
