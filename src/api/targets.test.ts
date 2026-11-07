import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { targetsApi } from './targets';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';

describe('targetsApi', () => {
  beforeEach(() => {
    // Im echten Stack ist orthancUrl = "/orthanc-proxy" — targetsApi muss
    // trotzdem direkt /targets-api/targets aufrufen, NICHT /orthanc-proxy/targets-api/targets.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '/orthanc-proxy',
      authMode: 'none',
      features: {},
    };
    loadConfig();
  });

  afterEach(() => {
    __resetConfigForTests();
    vi.restoreAllMocks();
  });

  it('list() ruft /targets-api/targets ohne orthancUrl-Präfix auf', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ targets: [{ aet: 'hst_burn2CD', label: 'HST BRENNER' }] }), {
        status: 200,
      }),
    );

    const targets = await targetsApi.list();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/targets-api/targets');
    expect(targets).toEqual([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
  });

  it('replace() sendet PUT an /targets-api/targets', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ targets: [{ aet: 'ZIEL_A', label: 'Ziel A' }] }), {
        status: 200,
      }),
    );

    const saved = await targetsApi.replace([{ aet: 'ZIEL_A', label: 'Ziel A' }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/targets-api/targets');
    expect((init as RequestInit).method).toBe('PUT');
    expect((init as RequestInit).body).toBe(JSON.stringify({ targets: [{ aet: 'ZIEL_A', label: 'Ziel A' }] }));
    expect(saved).toEqual([{ aet: 'ZIEL_A', label: 'Ziel A' }]);
  });
});
