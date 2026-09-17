/**
 * Viewport helpers for component tests.
 *
 * Components use `useMediaQuery('(max-width: 767px)')` to switch between the
 * desktop table and the mobile card layout. jsdom reports `matches: false` for
 * every query, so the mobile branch needs to be simulated explicitly.
 */
const DEFAULT_MATCH_MEDIA = window.matchMedia;

export function mockMobileViewport(): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export function resetViewport(): void {
  window.matchMedia = DEFAULT_MATCH_MEDIA;
}
