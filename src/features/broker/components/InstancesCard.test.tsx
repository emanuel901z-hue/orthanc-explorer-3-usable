/**
 * InstancesCard — "who is running?" (high availability).
 *
 * The card must keep the normal case quiet (one instance = no warning) and make
 * the HA case honest: more than one instance is not an error, but the operator
 * has to check two things the broker cannot see (shared spool volume, modalities
 * reaching the active instance).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { InstancesCard } from './InstancesCard';
import '@/i18n';

const { mockStatus } = vi.hoisted(() => ({ mockStatus: vi.fn() }));

vi.mock('@/api/broker', () => ({ brokerApi: { status: mockStatus } }));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><InstancesCard /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const base = {
  version: '1.0.0', started_at: '2026-09-22T10:00:00Z', uptime_s: 600,
  scp_listening: true, db_ok: true, sources: [], targets: [],
  counts: { queries: 0, stores: 0, seen_items: 0 },
};

const ONE = {
  ...base,
  instance_id: 'broker-a',
  instances_active: 1,
  instances: [{
    instance_id: 'broker-a', started_at: '2026-09-22T10:00:00Z',
    last_seen: '2026-09-22T10:10:00Z', age_s: 2, active: true, current: true,
    version: '1.0.0', hostname: 'broker-a', pid: 7,
  }],
};

const TWO = {
  ...base,
  instance_id: 'broker-a',
  instances_active: 2,
  instances: [
    ...ONE.instances,
    {
      instance_id: 'broker-b', started_at: '2026-09-22T10:05:00Z',
      last_seen: '2026-09-22T10:10:00Z', age_s: 5, active: true, current: false,
      version: '1.0.0', hostname: 'broker-b', pid: 9,
    },
  ],
};

const GONE = {
  ...base,
  instance_id: 'broker-a',
  instances_active: 1,
  instances: [
    ...ONE.instances,
    {
      instance_id: 'broker-b', started_at: '2026-09-22T09:00:00Z',
      last_seen: '2026-09-22T09:05:00Z', age_s: 3900, active: false, current: false,
      version: '1.0.0', hostname: 'broker-b', pid: 9,
    },
  ],
};

describe('InstancesCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockStatus.mockResolvedValue(ONE);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('names the instance that is answering', async () => {
    renderCard();

    expect(await screen.findByTestId('ha-current-instance')).toHaveTextContent('broker-a');
    expect(await screen.findByTestId('ha-active-count')).toHaveTextContent('1');
  });

  it('stays quiet with a single instance', async () => {
    renderCard();
    await screen.findByTestId('ha-instance-list');

    expect(screen.queryByTestId('ha-warning')).not.toBeInTheDocument();
  });

  it('lists every instance and marks this one', async () => {
    mockStatus.mockResolvedValue(TWO);
    renderCard();

    // the list element exists from the start (empty) — wait for the data
    await waitFor(async () => {
      const list = await screen.findByTestId('ha-instance-list');
      expect(list.textContent).toContain('broker-a');
      expect(list.textContent).toContain('broker-b');
      expect(list.textContent).toMatch(/diese hier|this one/i);
    });
  });

  it('warns when more than one instance runs — with what to check', async () => {
    mockStatus.mockResolvedValue(TWO);
    renderCard();

    const warning = await screen.findByTestId('ha-warning');
    expect(warning.textContent).toMatch(/spool[- ]volume/i);
    expect(warning.textContent).toMatch(/VIP|load balancer|lastverteiler/i);
  });

  it('marks an instance that stopped reporting as gone', async () => {
    mockStatus.mockResolvedValue(GONE);
    renderCard();

    await waitFor(async () => {
      const list = await screen.findByTestId('ha-instance-list');
      expect(list.textContent).toMatch(/weg|gone/i);
    });
    // the card is not alarming: one active instance is still the normal case
    expect(screen.queryByTestId('ha-warning')).not.toBeInTheDocument();
  });

  it('says so when no instance has reported yet', async () => {
    mockStatus.mockResolvedValue({ ...base, instance_id: 'broker-a', instances_active: 0, instances: [] });
    renderCard();

    await waitFor(() => expect(screen.getByText(/noch keine instanz|no instance has reported/i))
      .toBeInTheDocument());
  });
});
