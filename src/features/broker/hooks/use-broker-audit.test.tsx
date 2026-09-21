import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBrokerAuditWrites } from './use-broker-audit';
import { auditClient } from '@/lib/audit';

const { mockRollback, mockImport } = vi.hoisted(() => ({
  mockRollback: vi.fn(),
  mockImport: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    rbac: { status: vi.fn(() => Promise.resolve({ mode: 'off', enforced: false, can_write: true, write_role: 'brokerWrite', roles_header: 'X-OE3-Roles', roles: [] })) },
    audit: { rollback: mockRollback },
    config: { import: mockImport, export: vi.fn() },
  },
}));

const emit = vi.spyOn(auditClient, 'emit');

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useBrokerAuditWrites', () => {
  beforeEach(() => {
    mockRollback.mockResolvedValue({ audit_id: 7, entity: 'source', action: 'restore', message: 'ok' });
    mockImport.mockResolvedValue({ schema_version: 1, dry_run: false, changes: [], skipped: [], summary: { create: 0, update: 0, skipped: 0 } });
    emit.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it('audits a rollback with BEFORE/AFTER events', async () => {
    const { result } = renderHook(() => useBrokerAuditWrites(), { wrapper });

    result.current.rollback.mutate(7);

    await waitFor(() => expect(result.current.rollback.isSuccess).toBe(true));
    expect(mockRollback).toHaveBeenCalledWith(7);
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.config.rollback',
      resourceType: 'brokerConfig',
      resourceId: '7',
      outcome: 'started',
    });
    expect(emit.mock.calls[1][0]).toMatchObject({ outcome: 'success' });
  });

  it('audits an import with a non-PHI summary id', async () => {
    const { result } = renderHook(() => useBrokerAuditWrites(), { wrapper });

    result.current.importConfig.mutate({
      schema_version: 1,
      sources: [], targets: [], rules: [],
      transforms: [{ name: 't', enabled: true, priority: 1, operations: [] }],
      settings: {},
    });

    await waitFor(() => expect(result.current.importConfig.isSuccess).toBe(true));
    expect(mockImport).toHaveBeenCalledWith(expect.anything(), false);
    expect(emit.mock.calls[0][0]).toMatchObject({
      action: 'broker.config.import',
      resourceType: 'brokerConfig',
      resourceId: '0s/0t/0r/1m',
      outcome: 'started',
    });
  });

  it('survives a document without arrays', async () => {
    const { result } = renderHook(() => useBrokerAuditWrites(), { wrapper });

    // a hand-written file may omit the arrays entirely
    result.current.importConfig.mutate({ schema_version: 1 } as never);

    await waitFor(() => expect(result.current.importConfig.isSuccess).toBe(true));
    expect(emit.mock.calls[0][0]).toMatchObject({ resourceId: '0s/0t/0r/0m' });
  });

  it('audits a failing rollback', async () => {
    mockRollback.mockRejectedValue(new Error('not found'));
    const { result } = renderHook(() => useBrokerAuditWrites(), { wrapper });

    result.current.rollback.mutate(999);

    await waitFor(() => expect(result.current.rollback.isError).toBe(true));
    expect(emit.mock.calls[1][0]).toMatchObject({ outcome: 'failure', reason: 'not found' });
  });
});
