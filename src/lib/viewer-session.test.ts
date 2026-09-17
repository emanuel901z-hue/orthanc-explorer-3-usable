import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestViewerSession } from './viewer-session';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';

function setConfig(extra: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OE3_CONFIG__ = {
    orthancUrl: '', authMode: 'none', features: {}, ...extra,
  };
  loadConfig();
}

describe('requestViewerSession', () => {
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it('POSTs the viewer-session endpoint by default (backend-proxy mode)', async () => {
    setConfig({});
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    await requestViewerSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/pacs/viewer-session');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('skips the request when viewerSession is false (standalone stacks)', async () => {
    setConfig({ viewerSession: false });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await requestViewerSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows request failures — the viewer still opens', async () => {
    setConfig({});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(requestViewerSession()).resolves.toBeUndefined();
  });
});
