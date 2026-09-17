import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AtnaCard } from './AtnaCard';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import type { BrokerSetting } from '@/api/broker';
import '@/i18n';

const { mockStats, mockTest, mockSample, mockSet, mockReset } = vi.hoisted(() => ({
  mockStats: vi.fn(), mockTest: vi.fn(), mockSample: vi.fn(), mockSet: vi.fn(), mockReset: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    atna: { stats: mockStats, test: mockTest, sample: mockSample },
    settings: { list: vi.fn(), set: mockSet, reset: mockReset },
  },
}));

function setting(key: string, value: string, source: 'db' | 'env', kind = 'str'): BrokerSetting {
  return { key, value, default: '', source, kind, description: `${key} description` } as BrokerSetting;
}

const SETTINGS: BrokerSetting[] = [
  setting('atna_enabled', 'true', 'db', 'bool'),
  setting('atna_syslog_host', 'audit.example', 'db'),
  setting('atna_syslog_port', '6514', 'env', 'int'),
  setting('atna_syslog_protocol', 'tls', 'db', 'enum:tcp,tls'),
  setting('atna_tls_ca_file', '/etc/ssl/certs/ca.pem', 'env', 'path'),
  setting('atna_queue_max', '10000', 'env', 'int'),
];

function renderCard(settings: BrokerSetting[] = SETTINGS) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AtnaCard settings={settings} />
    </QueryClientProvider>,
  );
}

describe('AtnaCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStats.mockResolvedValue({
      enabled: true, configured: true, host: 'audit.example', port: 6514, protocol: 'tls',
      queue_size: 0, queue_max: 10000, worker_running: true,
    });
    mockTest.mockResolvedValue({ ok: true, error: '' });
    mockSample.mockResolvedValue({ xml: '<?xml version="1.0"?><AuditMessage><EventID/></AuditMessage>' });
    mockSet.mockResolvedValue(undefined);
    mockReset.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows the configuration state and the buffer', async () => {
    renderCard();

    expect(await screen.findByText(/repository configured/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('audit.example')).toBeInTheDocument();
    expect(screen.getByDisplayValue('6514')).toBeInTheDocument();
    expect(await screen.findByText(/audit\.example:6514 \(tls\)/)).toBeInTheDocument();
  });

  it('reports an unconfigured repository', async () => {
    mockStats.mockResolvedValue({
      enabled: false, configured: false, host: '', port: 6514, protocol: 'tcp',
      queue_size: 0, queue_max: 10000, worker_running: false,
    });
    renderCard([setting('atna_enabled', 'false', 'env', 'bool')]);

    expect(await screen.findByText(/not configured/i)).toBeInTheDocument();
  });

  it('toggles the audit switch', async () => {
    renderCard();

    // the <label for> names the toggle, aria-pressed carries the state
    fireEvent.click(await screen.findByRole('button', { name: /send audit messages/i }));

    // the hook calls the client with positional arguments
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith('atna_enabled', 'false'));
  });

  it('saves a changed host', async () => {
    renderCard();
    const input = await screen.findByLabelText(/audit repository \(host\)/i);

    fireEvent.change(input, { target: { value: 'audit2.example' } });

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith('atna_syslog_host', 'audit2.example'),
    );
  });

  it('sends a test message and reports success', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /send test message/i }));

    await waitFor(() => expect(mockTest).toHaveBeenCalled());
    expect(await screen.findByTestId('atna-test-result'))
      .toHaveTextContent(/accepted the test message/i);
  });

  it('reports a failing test message', async () => {
    mockTest.mockResolvedValue({ ok: false, error: 'connection refused' });
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /send test message/i }));

    expect(await screen.findByTestId('atna-test-result'))
      .toHaveTextContent(/delivery failed: connection refused/i);
  });

  it('shows the sample audit message on demand', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /show sample message/i }));

    const sample = await screen.findByTestId('atna-sample');
    await waitFor(() => expect(sample).toHaveTextContent('<AuditMessage>'));
  });

  it('offers a reset for overridden settings', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /reset to default/i }));

    await waitFor(() => expect(mockReset).toHaveBeenCalled());
    expect(mockReset.mock.calls.map((call) => call[0])).toContain('atna_enabled');
  });
});
