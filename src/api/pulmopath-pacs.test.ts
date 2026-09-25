import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pulmopathPacsApi } from './pulmopath-pacs';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { OrthancError } from '@/lib/errors';

function setConfig(orthancUrl: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OE3_CONFIG__ = { orthancUrl, authMode: 'none', features: {} };
  loadConfig();
}

describe('pulmopathPacsApi', () => {
  beforeEach(() => setConfig('/api/v1/pacs/orthanc'));
  afterEach(() => {
    __resetConfigForTests();
    vi.restoreAllMocks();
  });

  it('quarantineStudy() posts to the PP backend derived from orthancUrl', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, orthancStudyId: 'new-id', previousOrthancStudyId: 'old-id', quarantinePatientId: 'QRN-ADOPT-1' }), { status: 200 }),
    );

    const result = await pulmopathPacsApi.quarantineStudy({ orthancStudyId: 'old-id', reason: 'duplicate' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/pacs/quarantine/adopt');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ orthancStudyId: 'old-id', reason: 'duplicate' });
    expect(result.quarantinePatientId).toBe('QRN-ADOPT-1');
  });

  it('falls back to /api/v1/pacs when orthancUrl is not the backend proxy', async () => {
    setConfig('');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    await pulmopathPacsApi.quarantineStudy({ orthancStudyId: 'old-id' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/pacs/quarantine/adopt');
  });

  it('surfaces the backend message for 409 (study is needed / already quarantined)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Studie ist einer Untersuchung zugeordnet und wird gebraucht.' }), { status: 409 }),
    );

    await expect(pulmopathPacsApi.quarantineStudy({ orthancStudyId: 'x' })).rejects.toMatchObject({
      status: 409,
      message: 'Studie ist einer Untersuchung zugeordnet und wird gebraucht.',
    });
  });

  it('keeps the scrubbed message for unexpected statuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));

    const err = await pulmopathPacsApi.quarantineStudy({ orthancStudyId: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(OrthancError);
    expect((err as OrthancError).status).toBe(500);
    expect((err as OrthancError).message).toBe('The server encountered an error.');
  });
});
