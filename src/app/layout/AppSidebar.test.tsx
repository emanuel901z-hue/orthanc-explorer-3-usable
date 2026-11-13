import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import i18n from '@/i18n';

vi.mock('@/features/activity/hooks/useOrthancJobs', () => ({
  useOrthancJobs: () => ({ data: [], isLoading: false, isError: false }),
}));

function renderSidebar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppSidebar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '',
      authMode: 'none',
      features: { enableMwlBroker: false },
    };
    __resetConfigForTests();
    loadConfig();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__OE3_CONFIG__;
    __resetConfigForTests();
  });

  it('führt Remote-Quellen und Kopieraufträge als eigene Hauptpunkte', () => {
    renderSidebar();

    for (const name of [/remote-quellen/i, /kopieraufträge/i]) {
      const links = screen.getAllByRole('link', { name });
      expect(links).toHaveLength(1);
      // kein Unterpunkt, sondern ein Eintrag der Hauptliste
      expect(links[0].closest('[data-sidebar="menu-sub"]')).toBeNull();
      expect(links[0].closest('[data-sidebar="menu"]')).not.toBeNull();
    }
  });

  it('sortiert beide Punkte zwischen „Hochladen“ und „Aktivität“', () => {
    renderSidebar();

    const links = screen.getAllByRole('link');
    const index = (name: RegExp) => links.findIndex((link) => name.test(link.textContent ?? ''));
    const upload = index(/^hochladen$/i);
    const remoteSources = index(/^remote-quellen$/i);
    const copyJobs = index(/^kopieraufträge$/i);
    const activity = index(/^aktivität$/i);

    expect(upload).toBeGreaterThanOrEqual(0);
    expect(remoteSources).toBe(upload + 1);
    expect(copyJobs).toBe(upload + 2);
    expect(activity).toBeGreaterThan(copyJobs);
  });

  it('sortiert „Hochladen“ hinter die Studienliste', () => {
    renderSidebar();

    const links = screen.getAllByRole('link');
    const studies = links.findIndex((link) => /^studien$/i.test(link.textContent ?? ''));
    const upload = links.findIndex((link) => /^hochladen$/i.test(link.textContent ?? ''));

    expect(studies).toBeGreaterThanOrEqual(0);
    expect(upload).toBeGreaterThan(studies);
  });
});
