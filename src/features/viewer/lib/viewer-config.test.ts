/**
 * The viewer list is a deployment decision.
 *
 * Until now it lived only in the browser's `localStorage`, so every user had to
 * configure the viewers themselves and no admin could preset them. The runtime
 * config (`config.js`) now wins over the browser list, and `viewersLocked` makes
 * it read-only — the case "we only run OE3 and want everything preset".
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { loadViewers, saveViewers, viewersLocked, imageDisplayUrl } from './viewer-config';

function configure(config: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OE3_CONFIG__ = { orthancUrl: '', authMode: 'none', ...config };
  loadConfig();
}

describe('viewer config', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { __resetConfigForTests(); localStorage.clear(); });

  it('uses the browser list when the deployment presets nothing', () => {
    configure({});
    localStorage.setItem('oe3-viewers', JSON.stringify([
      { id: 'ohif', url: '/own/viewer', enabled: true, type: 'web' },
    ]));

    expect(loadViewers()).toEqual([{ id: 'ohif', url: '/own/viewer', enabled: true, type: 'web' }]);
    expect(viewersLocked()).toBe(false);
  });

  it('lets the deployment preset win over the browser list', () => {
    configure({ viewers: [{ id: 'ohif', url: '/ohif/viewer', enabled: true, type: 'web' }] });
    localStorage.setItem('oe3-viewers', JSON.stringify([
      { id: 'ohif', url: '/stale/browser/value', enabled: false, type: 'web' },
    ]));

    expect(loadViewers()[0].url).toBe('/ohif/viewer');
    // …and the IID entry point follows the deployment, not the browser
    expect(imageDisplayUrl()).toBe('/ohif/viewer');
  });

  it('does not write while the list is locked', () => {
    configure({ viewersLocked: true, viewers: [{ id: 'ohif', url: '/ohif/viewer' }] });

    expect(viewersLocked()).toBe(true);
    saveViewers([{ id: 'ohif', url: '/sneaky', enabled: true, type: 'web' }]);

    expect(localStorage.getItem('oe3-viewers')).toBeNull();
  });

  it('falls back to the stack default when nothing is configured', () => {
    configure({});
    expect(imageDisplayUrl()).toBe('/ohif/viewer');
  });
});
