import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TlsCard } from './TlsCard';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import type { BrokerSetting } from '@/api/broker';
import '@/i18n';

const { mockOverview, mockGenerate, mockTest, mockSet } = vi.hoisted(() => ({
  mockOverview: vi.fn(), mockGenerate: vi.fn(), mockTest: vi.fn(), mockSet: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    tls: { overview: mockOverview, generate: mockGenerate, test: mockTest },
    settings: { list: vi.fn(), set: mockSet, reset: vi.fn() },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

function setting(key: string, value: string, source: 'db' | 'env' = 'env'): BrokerSetting {
  return {
    key, value, default: '', source, kind: 'str', description: `${key} description`,
  } as unknown as BrokerSetting;
}

const SETTINGS: BrokerSetting[] = [
  setting('tls_inbound_enabled', 'true', 'db'),
  setting('tls_inbound_port', '2762'),
  setting('tls_inbound_cert_file', '/tls/server.crt', 'db'),
  setting('tls_inbound_key_file', '/tls/server.key', 'db'),
  setting('tls_inbound_ca_file', ''),
  setting('tls_inbound_client_auth', 'required', 'db'),
  setting('tls_outbound_verify', 'true'),
  setting('tls_outbound_ca_file', '/tls/pacs-ca.crt', 'db'),
  setting('tls_outbound_client_cert_file', ''),
  setting('tls_outbound_client_key_file', ''),
  setting('tls_dir', '/var/lib/mwl-broker/tls'),
];

const OVERVIEW = {
  inbound_enabled: true,
  inbound_port: 2762,
  inbound_client_auth: 'required',
  outbound_verify: true,
  directory: '/var/lib/mwl-broker/tls',
  entries: {
    inbound_cert: { path: '/tls/server.crt', ok: true, days_left: 320, expired: false, expiring_soon: false },
    inbound_key: { path: '/tls/server.key', ok: true, mode: '600' },
  },
  certificates: [
    { role: 'inbound_cert', path: '/tls/server.crt', subject: 'mwl-broker.hospital.local',
      days_left: 320, expired: false, expiring_soon: false, error: '' },
    { role: 'outbound_ca', path: '/tls/pacs-ca.crt', subject: 'Hospital CA',
      days_left: 12, expired: false, expiring_soon: true, error: '' },
  ],
};

function renderCard(settings: BrokerSetting[] = SETTINGS) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TlsCard settings={settings} />
    </QueryClientProvider>,
  );
}

describe('TlsCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockOverview.mockResolvedValue(OVERVIEW);
    mockGenerate.mockResolvedValue({
      certificate_path: '/var/lib/mwl-broker/tls/mwl-broker.crt',
      key_path: '/var/lib/mwl-broker/tls/mwl-broker.key',
      certificate_pem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
      certificate: {}, key: {}, is_ca: false,
    });
    mockTest.mockResolvedValue({
      host: '10.0.1.30', port: 2762, ok: true, error: '', protocol: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384', peer_subject: 'PACS_KH', peer_issuer: 'Hospital CA',
      peer_not_after: '2027-09-17T00:00:00Z', peer_san: ['10.0.1.30'],
      echo_ok: true, echo_error: '',
    });
    mockSet.mockResolvedValue(undefined);
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows the listener state and the configured certificates', async () => {
    renderCard();

    expect(await screen.findByText(/TLS listener on port 2762/i)).toBeInTheDocument();
    const list = await screen.findByTestId('tls-certificates');
    expect(within(list).getByText('mwl-broker.hospital.local')).toBeInTheDocument();
    expect(within(list).getByText(/320 days left/i)).toBeInTheDocument();
    // an expiring certificate is flagged
    expect(within(list).getByText(/expires in 12 days/i)).toBeInTheDocument();
  });

  it('reports that no listener is configured', async () => {
    mockOverview.mockResolvedValue({
      ...OVERVIEW, inbound_enabled: false, certificates: [], entries: {},
    });
    renderCard([setting('tls_inbound_enabled', 'false')]);

    expect(await screen.findByText(/no TLS listener/i)).toBeInTheDocument();
  });

  it('switches the TLS listener on and off', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('switch', { name: /accept tls from the modalities/i }));

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith('tls_inbound_enabled', 'false'),
    );
  });

  it('saves a changed certificate path', async () => {
    renderCard();
    const input = await screen.findByLabelText(/server certificate \(pem\)/i);

    fireEvent.change(input, { target: { value: '/tls/other.crt' } });

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith('tls_inbound_cert_file', '/tls/other.crt'),
    );
  });

  it('generates a self-signed certificate and shows the public part', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /generate a self-signed certificate/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/common name/i), {
      target: { value: 'mwl-broker.hospital.local' },
    });
    fireEvent.change(within(dialog).getByLabelText(/also valid for/i), {
      target: { value: '10.0.1.47, mwl-broker.hospital.local' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalled());
    expect(mockGenerate.mock.calls[0][0]).toMatchObject({
      common_name: 'mwl-broker.hospital.local',
      san: ['10.0.1.47', 'mwl-broker.hospital.local'],
      is_ca: false,
    });
    // the public certificate is shown for hand-over
    const pem = await within(dialog).findByLabelText(/public certificate/i) as HTMLTextAreaElement;
    expect(pem.value).toContain('BEGIN CERTIFICATE');
    expect(emit.mock.calls[0][0]).toMatchObject({ action: 'broker.tls.generate' });
  });

  it('runs an endpoint check and reports protocol, peer and C-ECHO', async () => {
    renderCard();

    fireEvent.change(await screen.findByLabelText(/^host$/i), { target: { value: '10.0.1.30' } });
    fireEvent.change(screen.getByLabelText(/c-echo ae title/i), { target: { value: 'PACS_KH' } });
    fireEvent.click(screen.getByRole('button', { name: /run check/i }));

    await waitFor(() => expect(mockTest).toHaveBeenCalled());
    const result = await screen.findByTestId('tls-test-result');
    expect(result).toHaveTextContent(/handshake succeeded/i);
    expect(result).toHaveTextContent('TLSv1.3');
    expect(result).toHaveTextContent('PACS_KH');
    expect(result).toHaveTextContent(/answered/i);
  });

  it('reports a failed check in plain words', async () => {
    mockTest.mockResolvedValue({
      host: '10.0.1.30', port: 2762, ok: false,
      error: 'certificate verification failed: self-signed certificate',
      protocol: '', cipher: '', peer_subject: '', peer_issuer: '', peer_not_after: '',
      peer_san: [], echo_ok: null, echo_error: '',
    });
    renderCard();

    fireEvent.change(await screen.findByLabelText(/^host$/i), { target: { value: '10.0.1.30' } });
    fireEvent.click(screen.getByRole('button', { name: /run check/i }));

    expect(await screen.findByTestId('tls-test-result'))
      .toHaveTextContent(/certificate verification failed/i);
  });
});
