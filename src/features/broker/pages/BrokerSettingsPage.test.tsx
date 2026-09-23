import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BrokerSettingsPage from './BrokerSettingsPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockList, mockSet, mockReset, mockToast } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSet: vi.fn(),
  mockReset: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    status: vi.fn(() => Promise.resolve({
      scp_listening: true, db_ok: true, sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    })),
    sources: { list: vi.fn(() => Promise.resolve([])), echo: vi.fn() },
    targets: { list: vi.fn(() => Promise.resolve([])), echo: vi.fn() },
    rules: { list: vi.fn(() => Promise.resolve([])) },
    transforms: { list: vi.fn(() => Promise.resolve([])) },
    settings: { list: mockList, set: mockSet, reset: mockReset },
    retention: {
      overview: vi.fn(() => Promise.resolve({ tables: [] })),
      purge: vi.fn(() => Promise.resolve({ removed: {}, total: 0 })),
    },
    tls: {
      overview: vi.fn(() => Promise.resolve({
        inbound_enabled: false, inbound_port: 2762, inbound_client_auth: 'none',
        outbound_verify: true, directory: '/var/lib/mwl-broker/tls',
        entries: {}, certificates: [],
      })),
      generate: vi.fn(() => Promise.resolve({})),
      test: vi.fn(() => Promise.resolve({ ok: false, error: 'not checked' })),
    },
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

  it('labels a setting in words, never with its raw key', async () => {
    // without a translation the page would show "spool_lease_s" — a novice-safe
    // interface must not do that (a backend test keeps the locales complete)
    mockList.mockResolvedValue([{
      key: 'spool_lease_s', value: '300', default: '300', source: 'db' as const,
      kind: 'int' as const,
      description: 'How long one instance may hold a claimed spool entry.',
      min: 30, max: 86400,
    }]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/spool claim: lease/i)).toBeInTheDocument());
    expect(screen.queryByText('spool_lease_s')).not.toBeInTheDocument();
  });

  it('toggles a boolean setting through the switch', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Strict store status')).toBeInTheDocument());

    // scoped: the TLS/alerting cards render switches of their own
    const row = within(screen.getByTestId('setting-strict_store_status'));
    fireEvent.click(row.getByRole('switch'));

    await waitFor(() => expect(mockSet).toHaveBeenCalledTimes(1));
    expect(mockSet.mock.calls[0]).toEqual(['strict_store_status', 'false']);
  });

  it('constrains integer settings with bounds from the API', async () => {
    mockList.mockResolvedValue([
      {
        key: 'echo_interval_s', value: '30', default: '30', source: 'env' as const,
        kind: 'int' as const, description: 'Interval of the C-ECHO loop.',
        min: 5, max: 3600, choices: [],
      },
    ]);
    renderPage();

    const input = await screen.findByLabelText(/Echo interval|echo_interval_s/i)
      .catch(() => screen.findByLabelText(/Interval of the C-ECHO loop/i));
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '5');
    expect(input).toHaveAttribute('max', '3600');
    // the allowed range is stated in plain words
    expect(screen.getByText(/allowed: 5 to 3600/i)).toBeInTheDocument();
  });

  it('renders enum settings as a choice instead of free text', async () => {
    mockList.mockResolvedValue([
      {
        key: 'rbac_mode', value: 'off', default: 'off', source: 'env' as const,
        kind: 'enum:off,enforce' as const, description: 'Access mode.',
        choices: ['off', 'enforce'],
      },
    ]);
    renderPage();

    // no free-text field for a value with a fixed set of options
    const row = await screen.findByTestId('setting-rbac_mode');
    expect(within(row).getByLabelText(/Access mode/i)).toBeInTheDocument();
    expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('catches an invalid value before sending it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Allowed calling AE titles')).toBeInTheDocument());

    const row = within(screen.getByTestId('setting-allowed_calling_aets'));
    fireEvent.change(row.getByLabelText('Allowed calling AE titles'), {
      target: { value: 'nope!' },                       // invalid AE title
    });

    // the hint appears immediately and the value cannot be sent
    const rowEl = screen.getByTestId('setting-allowed_calling_aets');
    expect(within(rowEl).getByRole('alert')).toHaveTextContent(/invalid ae title/i);
    expect(within(rowEl).getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('shows the server message when the server rejects a valid-looking value', async () => {
    mockSet.mockRejectedValue(new Error('must be between 5 and 3600'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Allowed calling AE titles')).toBeInTheDocument());

    const row = within(screen.getByTestId('setting-allowed_calling_aets'));
    fireEvent.change(row.getByLabelText('Allowed calling AE titles'), {
      target: { value: 'MR_01' },                       // valid and different
    });
    fireEvent.click(row.getByRole('button', { name: /^save$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/rejected/i);
    expect(alert).toHaveTextContent('must be between 5 and 3600');
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it('confirms a successful save', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Allowed calling AE titles')).toBeInTheDocument());

    const row = within(screen.getByTestId('setting-allowed_calling_aets'));
    fireEvent.change(row.getByLabelText('Allowed calling AE titles'), {
      target: { value: 'CT_01,MR_01' },                 // valid
    });
    fireEvent.click(row.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockSet).toHaveBeenCalled());
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
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
