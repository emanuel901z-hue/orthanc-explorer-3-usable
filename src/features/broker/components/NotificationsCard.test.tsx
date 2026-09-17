import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsCard } from './NotificationsCard';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import type { BrokerSetting } from '@/api/broker';
import '@/i18n';

const { mockEvents, mockTest, mockSet, mockReset } = vi.hoisted(() => ({
  mockEvents: vi.fn(),
  mockTest: vi.fn(),
  mockSet: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    notify: { events: mockEvents, test: mockTest },
    settings: { list: vi.fn(), set: mockSet, reset: mockReset },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

function setting(key: string, value: string, source: 'db' | 'env', kind = 'str'): BrokerSetting {
  return { key, value, default: '', source, kind, description: `${key} description` } as BrokerSetting;
}

const SETTINGS: BrokerSetting[] = [
  setting('notify_webhook_url', 'https://hooks.example/x', 'db', 'url'),
  setting('notify_events', 'source_down', 'db', 'events'),
  setting('notify_min_interval_s', '300', 'env', 'int'),
];

function renderCard(settings: BrokerSetting[] = SETTINGS) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsCard settings={settings} />
    </QueryClientProvider>,
  );
}

describe('NotificationsCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockEvents.mockResolvedValue([
      { code: 'source_down', severity: 'error', description: 'A source stopped answering.' },
      { code: 'spool_dead_letter', severity: 'error', description: 'A spooled instance gave up.' },
      { code: 'source_recovered', severity: 'info', description: 'A source answers again.' },
    ]);
    mockTest.mockResolvedValue({ ok: true, error: '' });
    mockSet.mockResolvedValue(undefined);
    mockReset.mockResolvedValue(undefined);
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('shows the webhook state and the known events', async () => {
    renderCard();

    expect(await screen.findByText(/webhook configured/i)).toBeInTheDocument();
    const events = await screen.findByTestId('notify-events');
    // the event list arrives with the query
    await within(events).findByLabelText('source_down');
    expect(within(events).getByLabelText('source_down')).toBeChecked();
    expect(within(events).getByLabelText('spool_dead_letter')).not.toBeChecked();
    expect(within(events).getByLabelText('source_recovered')).not.toBeChecked();
    // severity and description come from the API
    expect(within(events).getAllByText('error').length).toBe(2);
    expect(within(events).getByText('A source stopped answering.')).toBeInTheDocument();
  });

  it('reports an unconfigured webhook', async () => {
    renderCard([
      setting('notify_webhook_url', '', 'env', 'url'),
      setting('notify_events', '', 'env', 'events'),
    ]);

    expect(await screen.findByText(/not configured/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /send test message/i })).toBeEnabled();
  });

  it('saves the event selection as a comma-separated list', async () => {
    renderCard();
    const events = await screen.findByTestId('notify-events');
    await within(events).findByLabelText('spool_dead_letter');

    fireEvent.click(within(events).getByLabelText('spool_dead_letter'));
    fireEvent.click(within(events).getByLabelText('source_down'));   // deselect
    const save = within(events.parentElement as HTMLElement)
      .getAllByRole('button', { name: /^save$/i })[0];
    fireEvent.click(save);

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith('notify_events', 'spool_dead_letter'));
    expect(emit.mock.calls[0][0]).toMatchObject({ action: 'broker.setting.update' });
  });

  it('saves the webhook URL only when it changed', async () => {
    renderCard();
    const input = await screen.findByLabelText(/webhook url/i) as HTMLInputElement;
    expect(input.value).toBe('https://hooks.example/x');

    const save = screen.getAllByRole('button', { name: /^save$/i })[0];
    expect(save).toBeDisabled();

    fireEvent.change(input, { target: { value: 'https://hooks.example/y' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith('notify_webhook_url', 'https://hooks.example/y'),
    );
  });

  it('sends a test message and reports success', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /send test message/i }));

    await waitFor(() => expect(mockTest).toHaveBeenCalled());
    expect(await screen.findByTestId('notify-test-result'))
      .toHaveTextContent(/accepted the test message/i);
  });

  it('reports a failing test message with the error', async () => {
    mockTest.mockResolvedValue({ ok: false, error: 'HTTP 500' });
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /send test message/i }));

    expect(await screen.findByTestId('notify-test-result'))
      .toHaveTextContent(/delivery failed: HTTP 500/i);
  });

  it('saves the de-bounce interval', async () => {
    renderCard();
    const input = await screen.findByLabelText(/minimum interval/i) as HTMLInputElement;
    expect(input.value).toBe('300');

    fireEvent.change(input, { target: { value: '60' } });
    const buttons = screen.getAllByRole('button', { name: /^save$/i });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith('notify_min_interval_s', '60'),
    );
  });

  it('offers a reset for an overridden URL', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /reset to default/i }));

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith('notify_webhook_url'));
  });
});
