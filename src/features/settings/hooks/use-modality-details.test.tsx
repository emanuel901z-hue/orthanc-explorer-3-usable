import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useModalityDetails } from './use-modality-details';
import { modalitiesApi } from '@/api/modalities';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('useModalityDetails', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', authMode: 'none', features: {} };
    loadConfig();
  });

  afterEach(() => {
    __resetConfigForTests();
    vi.restoreAllMocks();
  });

  it('liefert Name, AET, Host und Port aus /modalities?expand', async () => {
    vi.spyOn(modalitiesApi, 'listExpanded').mockResolvedValue({
      ARCHIVE: { AET: 'ARCHIVE', Host: '10.0.1.30', Port: 104 },
      LOCAL: { AET: 'ORTHANC-CP-SRV', Host: '127.0.0.1', Port: 4843 },
    });

    const { result } = renderHook(() => useModalityDetails(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: 'ARCHIVE', aet: 'ARCHIVE', host: '10.0.1.30', port: 104 },
      { id: 'LOCAL', aet: 'ORTHANC-CP-SRV', host: '127.0.0.1', port: 4843 },
    ]);
  });

  it('fällt auf sinnvolle Platzhalter zurück, wenn Orthanc Felder weglässt', async () => {
    vi.spyOn(modalitiesApi, 'listExpanded').mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      HALF: { AET: '', Host: '', Port: 0 } as any,
    });

    const { result } = renderHook(() => useModalityDetails(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // AET fällt auf den Namen zurück, Host auf den Platzhalter
    expect(result.current.data?.[0]).toMatchObject({ id: 'HALF', aet: 'HALF', host: '—', port: 0 });
  });
});
