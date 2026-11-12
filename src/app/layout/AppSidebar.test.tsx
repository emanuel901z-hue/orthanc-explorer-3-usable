import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

/** Die Unterliste des Punktes „Hochladen“. */
function uploadSubMenu(): HTMLElement {
  const uploadLink = screen.getByRole('link', { name: /^(hochladen|upload)$/i });
  const subMenu = uploadLink.closest('li')?.querySelector('[data-sidebar="menu-sub"]');
  expect(subMenu).not.toBeNull();
  return subMenu as HTMLElement;
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

  it('hängt Remote-Quellen und Kopieraufträge unter „Hochladen“', () => {
    renderSidebar();

    const subMenu = uploadSubMenu();
    expect(within(subMenu).getByRole('link', { name: /remote-quellen/i })).toBeInTheDocument();
    expect(within(subMenu).getByRole('link', { name: /kopieraufträge/i })).toBeInTheDocument();
  });

  it('führt die Kopier-Strecke nicht mehr als eigenen Hauptpunkt', () => {
    renderSidebar();

    // genau ein Eintrag je Ziel, und der hängt am Punkt „Hochladen“
    for (const name of [/remote-quellen/i, /kopieraufträge/i]) {
      const links = screen.getAllByRole('link', { name });
      expect(links).toHaveLength(1);
      expect(links[0].closest('[data-sidebar="menu-sub"]')).not.toBeNull();
      const parentItem = links[0].closest('[data-sidebar="menu-item"]');
      expect(parentItem?.querySelector('a[href="/upload"]')).not.toBeNull();
    }
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
