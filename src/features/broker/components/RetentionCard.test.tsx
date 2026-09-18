import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RetentionCard } from './RetentionCard';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditClient } from '@/lib/audit';
import '@/i18n';

const { mockOverview, mockPurge } = vi.hoisted(() => ({
  mockOverview: vi.fn(), mockPurge: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    retention: { overview: mockOverview, purge: mockPurge },
    settings: { list: vi.fn(), set: vi.fn(), reset: vi.fn() },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

const OVERVIEW = {
  tables: [
    { table: 'query_log', description: 'Worklist queries', rows: 2,
      oldest: '2026-08-19T10:00:00Z', retention_days: 90, will_delete: 1 },
    { table: 'config_audit', description: 'Configuration change log', rows: 5,
      oldest: null, retention_days: 0, will_delete: 0 },
  ],
};

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RetentionCard />
    </QueryClientProvider>,
  );
}

describe('RetentionCard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockOverview.mockResolvedValue(OVERVIEW);
    mockPurge.mockResolvedValue({ removed: { query_log: 1 }, total: 1 });
    emit.mockClear();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('lists every table with rows, oldest entry and retention', async () => {
    renderCard();

    const list = await screen.findByTestId('retention-tables');
    await waitFor(() => expect(list.textContent).toContain('Worklist queries'));
    expect(within(list).getByText(/worklist queries/i)).toBeInTheDocument();
    expect(list.textContent).toContain('2 rows');
    expect(within(list).getByText('90 days')).toBeInTheDocument();
    expect(within(list).getByText('1 would be deleted')).toBeInTheDocument();
  });

  it('purges after confirmation, audits it and reports the result', async () => {
    renderCard();
    await waitFor(() => expect(screen.getByTestId('retention-tables')).toBeInTheDocument());

    fireEvent.click(await screen.findByRole('button', { name: /purge now/i }));
    expect(mockPurge).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockPurge).toHaveBeenCalled());
    expect(await screen.findByTestId('retention-purge-result')).toHaveTextContent('1');
    expect(emit.mock.calls[0][0]).toMatchObject({ action: 'broker.retention.purge' });
  });

  it('disables the purge when nothing is deletable', async () => {
    mockOverview.mockResolvedValue({
      tables: OVERVIEW.tables.map((entry) => ({ ...entry, will_delete: 0 })),
    });
    renderCard();

    expect(await screen.findByRole('button', { name: /purge now/i })).toBeDisabled();
  });
});
