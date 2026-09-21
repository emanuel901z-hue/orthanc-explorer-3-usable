import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import WorklistsPage from './pages/WorklistsPage';
import '@/i18n';

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn(() => Promise.resolve([])) }));
vi.mock('@/api/worklists', () => ({
  worklistsApi: { list: mockList, get: vi.fn(), query: vi.fn(), delete: vi.fn() },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><WorklistsPage /></MemoryRouter></QueryClientProvider>,
  );
}

describe('worklists page feature gate', () => {
  beforeEach(() => { mockList.mockClear(); });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('does not query the plugin when the feature is off (404-free)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '/orthanc-proxy', authMode: 'none', features: { enableWorklists: false } };
    loadConfig();

    renderPage();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // the deployment serves MWL through the broker; the plugin API is off, so
    // the page must not fire a request that would 404 in the console
    expect(mockList).not.toHaveBeenCalled();
  });

  it('queries it when the operator switched the feature on', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '/orthanc-proxy', authMode: 'none', features: { enableWorklists: true } };
    loadConfig();

    renderPage();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockList).toHaveBeenCalled();
  });
});
