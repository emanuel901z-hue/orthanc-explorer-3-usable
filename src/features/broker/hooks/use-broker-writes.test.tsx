/**
 * Verifies the fork's audit contract for broker configuration writes:
 * every write emits BEFORE (started) and AFTER (success/failure).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useBrokerSourceWrites,
  useBrokerSettingWrites,
  useBrokerTargetWrites,
  useBrokerRuleWrites,
  useBrokerTransformWrites,
} from './use-broker-writes';
import { auditClient } from '@/lib/audit';

const {
  mockCreate, mockSet, mockReset, mockResetBreaker,
  targetCreate, targetUpdate, targetDelete,
  ruleCreate, ruleUpdate, ruleDelete,
  transformCreate, transformUpdate, transformDelete,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(), mockSet: vi.fn(), mockReset: vi.fn(), mockResetBreaker: vi.fn(),
  targetCreate: vi.fn(), targetUpdate: vi.fn(), targetDelete: vi.fn(),
  ruleCreate: vi.fn(), ruleUpdate: vi.fn(), ruleDelete: vi.fn(),
  transformCreate: vi.fn(), transformUpdate: vi.fn(), transformDelete: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    sources: {
      create: mockCreate, update: vi.fn(), delete: vi.fn(), list: vi.fn(), echo: vi.fn(),
      resetBreaker: mockResetBreaker,
    },
    targets: {
      create: targetCreate, update: targetUpdate, delete: targetDelete,
      list: vi.fn(), echo: vi.fn(),
    },
    rules: { create: ruleCreate, update: ruleUpdate, delete: ruleDelete, list: vi.fn() },
    transforms: {
      create: transformCreate, update: transformUpdate, delete: transformDelete, list: vi.fn(),
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

  it('covers the target, rule and transform write paths', async () => {
    targetCreate.mockResolvedValue({ id: 11 });
    targetUpdate.mockResolvedValue({ id: 11 });
    targetDelete.mockResolvedValue(undefined);
    ruleCreate.mockResolvedValue({ id: 21 });
    ruleUpdate.mockResolvedValue({ id: 21 });
    ruleDelete.mockResolvedValue(undefined);
    transformCreate.mockResolvedValue({ id: 31 });
    transformUpdate.mockResolvedValue({ id: 31 });
    transformDelete.mockResolvedValue(undefined);

    const targets = renderHook(() => useBrokerTargetWrites(), { wrapper });
    targets.result.current.create.mutate({ name: 'pacs', aet: 'PACS', host: 'h', port: 104,
      calling_aet: 'MWLBROKER', enabled: true, is_default: true });
    await waitFor(() => expect(targets.result.current.create.isSuccess).toBe(true));
    targets.result.current.update.mutate({ id: 11, body: { name: 'pacs2', aet: 'PACS',
      host: 'h', port: 104, calling_aet: 'MWLBROKER', enabled: false, is_default: false } });
    await waitFor(() => expect(targetUpdate).toHaveBeenCalledWith(11, expect.objectContaining({ name: 'pacs2' })));
    targets.result.current.remove.mutate(11);
    await waitFor(() => expect(targetDelete).toHaveBeenCalledWith(11));

    const rules = renderHook(() => useBrokerRuleWrites(), { wrapper });
    rules.result.current.create.mutate({ source_id: 1, target_id: 2, priority: 5, enabled: true });
    await waitFor(() => expect(ruleCreate).toHaveBeenCalled());
    rules.result.current.update.mutate({ id: 21, body: { source_id: 1, target_id: 2, priority: 9, enabled: false } });
    await waitFor(() => expect(ruleUpdate).toHaveBeenCalledWith(21, expect.objectContaining({ priority: 9 })));
    rules.result.current.remove.mutate(21);
    await waitFor(() => expect(ruleDelete).toHaveBeenCalledWith(21));

    const transforms = renderHook(() => useBrokerTransformWrites(), { wrapper });
    transforms.result.current.create.mutate({ name: 't', enabled: true, priority: 1,
      source_id: null, target_id: null, operations: [{ op: 'remove', tag: 'PatientAddress' }] });
    await waitFor(() => expect(transformCreate).toHaveBeenCalled());
    transforms.result.current.update.mutate({ id: 31, body: { name: 't2', enabled: false, priority: 2,
      source_id: null, target_id: null, operations: [{ op: 'remove', tag: 'PatientID' }] } });
    await waitFor(() => expect(transformUpdate).toHaveBeenCalledWith(31, expect.objectContaining({ name: 't2' })));
    transforms.result.current.remove.mutate(31);
    await waitFor(() => expect(transformDelete).toHaveBeenCalledWith(31));

    // audit events for the extra paths
    const actions = emit.mock.calls.map(([e]) => (e as { action: string }).action);
    expect(actions).toEqual(expect.arrayContaining([
      'broker.target.create', 'broker.target.update', 'broker.target.delete',
      'broker.rule.create', 'broker.rule.update', 'broker.rule.delete',
      'broker.transform.create', 'broker.transform.update', 'broker.transform.delete',
    ]));
  });

  it('audits a circuit-breaker reset', async () => {
    mockResetBreaker.mockResolvedValue({ source_id: 7, name: 'ris-a', state: 'closed' });
    const { result } = renderHook(() => useBrokerSourceWrites(), { wrapper });

    result.current.resetBreaker.mutate(7);

    await waitFor(() => expect(result.current.resetBreaker.isSuccess).toBe(true));
    expect(mockResetBreaker).toHaveBeenCalledWith(7);
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.source.breaker_reset',
      resourceType: 'brokerSource',
      outcome: 'started',
      resourceId: '7',
    });
    expect(emit.mock.calls[1][0]).toMatchObject({ outcome: 'success' });
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
