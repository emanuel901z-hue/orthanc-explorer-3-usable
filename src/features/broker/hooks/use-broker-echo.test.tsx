import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBrokerEcho } from './use-broker-echo';

const { mockSourceEcho, mockTargetEcho } = vi.hoisted(() => ({
  mockSourceEcho: vi.fn(),
  mockTargetEcho: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    sources: { echo: mockSourceEcho },
    targets: { echo: mockTargetEcho },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useBrokerEcho', () => {
  beforeEach(() => {
    mockSourceEcho.mockResolvedValue({ ok: true, rtt_ms: 12 });
    mockTargetEcho.mockResolvedValue({ ok: true, rtt_ms: 9 });
  });
  afterEach(() => vi.clearAllMocks());

  it('echoes a source', async () => {
    const { result } = renderHook(() => useBrokerEcho(), { wrapper });
    result.current.mutate({ kind: 'source', id: 3 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSourceEcho).toHaveBeenCalledWith(3);
    expect(mockTargetEcho).not.toHaveBeenCalled();
  });

  it('echoes a target', async () => {
    const { result } = renderHook(() => useBrokerEcho(), { wrapper });
    result.current.mutate({ kind: 'target', id: 7 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTargetEcho).toHaveBeenCalledWith(7);
    expect(mockSourceEcho).not.toHaveBeenCalled();
  });
});
