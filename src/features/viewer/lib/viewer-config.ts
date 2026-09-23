import { getConfig } from '@/config/runtime';

/**
 * Which viewer opens a study?
 *
 * The viewer list lives in `localStorage` (`oe3-viewers`, edited under
 * Settings → Viewers). The IHE image display of this stack is OHIF, so that is
 * the entry the IID endpoint resolves — a deployment may point the OHIF entry
 * at another host, and then that URL wins.
 */
const FALLBACK_VIEWER_URL = '/ohif/viewer';

export interface StoredViewer {
  id: string;
  url: string;
  enabled: boolean;
  type: string;
}

/**
 * The viewer list of this deployment.
 *
 * Precedence: the runtime config (`viewers`, set by the deployment) wins over
 * the browser's own list in `localStorage`. That is what makes a hospital-wide
 * preset possible at all — until now every user had to configure the viewers in
 * their own browser. With `viewersLocked` the config is the only source.
 */
/** Config access that also works before the boot config is parsed (tests, IID
 * entry point): the deployment settings are optional for this module. */
function configuredViewers(): StoredViewer[] {
  try {
    return (getConfig().viewers ?? []).map((viewer) => ({
      id: viewer.id,
      url: viewer.url,
      enabled: viewer.enabled ?? true,
      type: viewer.type ?? 'web',
    }));
  } catch {
    return [];
  }
}

export function loadViewers(): StoredViewer[] {
  const configured = configuredViewers();
  if (configured.length > 0) {
    return configured;
  }
  try {
    return JSON.parse(localStorage.getItem('oe3-viewers') || '[]') as StoredViewer[];
  } catch {
    return [];
  }
}

/** True when the deployment preset the viewer list and forbids changes. */
export function viewersLocked(): boolean {
  try {
    return getConfig().viewersLocked === true;
  } catch {
    return false;
  }
}

/** Persist the user's own list — only when the deployment allows it. */
export function saveViewers(viewers: StoredViewer[]): void {
  if (viewersLocked()) return;
  localStorage.setItem('oe3-viewers', JSON.stringify(viewers));
}

/** The web viewer an external "display this study" request should open. */
export function imageDisplayUrl(): string {
  const ohif = loadViewers().find((v) => v.id === 'ohif' && v.enabled && v.url);
  return ohif?.url || FALLBACK_VIEWER_URL;
}
