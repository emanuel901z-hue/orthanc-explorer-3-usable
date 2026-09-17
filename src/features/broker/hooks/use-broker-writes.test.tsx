/**
 * Verifies the fork's audit contract for broker configuration writes:
 * every write emits BEFORE (started) and AFTER (success/failure).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBrokerSourceWrites, useBrokerSettingWrites } from './use-broker-writes';
import { auditClient } from '@/lib/audit';

const { mockCreate, mockSet, mockReset } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSet: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    sources: {
      create: mockCreate, update: vi.fn(), delete: vi.fn(), list: vi.fn(), echo: vi.fn(),
    },
    settings: { set: mockSet, reset: mockReset, list: vi.fn() },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('use-broker-writes audit contract', () => {
  let emit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    emit = vi.spyOn(auditClient, 'emit').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const SOURCE = {
    name: 'ris-a', aet: 'RIS_A', host: 'h', port: 104,
    calling_aet: 'MWLBROKER', charset: 'ISO_IR 100',
    enabled: true, timeout_s: 10, priority: 10,
  };

  it('emits started + success with the created row id', async () => {
    mockCreate.mockResolvedValue({ id: 42 });
    const { result } = renderHook(() => useBrokerSourceWrites(), { wrapper });

    result.current.create.mutate(SOURCE);

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.source.create',
      resourceType: 'brokerSource',
      outcome: 'started',
    });
    expect(emit.mock.calls[1][0]).toMatchObject({
      action: 'broker.source.create',
      outcome: 'success',
      resourceId: '42',
    });
  });

  it('emits started + failure with the reason', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useBrokerSourceWrites(), { wrapper });

    result.current.create.mutate(SOURCE);

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1][0]).toMatchObject({
      action: 'broker.source.create',
      outcome: 'failure',
      reason: 'boom',
    });
  });

  it('audits setting overrides by key', async () => {
    mockSet.mockResolvedValue({ key: 'echo_interval_s', value: '45', source: 'db' });
    const { result } = renderHook(() => useBrokerSettingWrites(), { wrapper });

    result.current.setValue.mutate({ key: 'echo_interval_s', value: '45' });

    await waitFor(() => expect(result.current.setValue.isSuccess).toBe(true));
    expect(emit.mock.calls[1][0]).toMatchObject({
      action: 'broker.setting.update',
      resourceType: 'brokerSetting',
      resourceId: 'echo_interval_s',
      outcome: 'success',
    });
  });

  it('invalidates the settings query after a write (regression)', async () => {
    // The settings page renders from ['broker','settings'] — without this key
    // in the invalidation list the badge/value never updates after saving.
    mockSet.mockResolvedValue({ key: 'echo_interval_s', value: '45', source: 'db' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useBrokerSettingWrites(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.setValue.mutate({ key: 'echo_interval_s', value: '45' });
    await waitFor(() => expect(result.current.setValue.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
    expect(keys).toContain(JSON.stringify(['broker', 'settings']));
  });

  it('audits setting resets', async () => {
    mockReset.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBrokerSettingWrites(), { wrapper });

    result.current.reset.mutate('strict_store_status');

    await waitFor(() => expect(result.current.reset.isSuccess).toBe(true));
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.setting.reset',
      outcome: 'started',
      resourceId: 'strict_store_status',
    });
  });
});
