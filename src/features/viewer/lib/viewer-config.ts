/**
 * Which viewer opens a study?
 *
 * The viewer list lives in `localStorage` (`oe3-viewers`, edited under
 * Settings → Viewers). The IHE image display of this stack is OHIF, so that is
 * the entry the IID endpoint resolves — a deployment may point the OHIF entry
 * at another host, and then that URL wins.
 */
const FALLBACK_VIEWER_URL = '/ohif/viewer';

interface StoredViewer {
  id: string;
  url: string;
  enabled: boolean;
  type: string;
}

/** The web viewer an external "display this study" request should open. */
export function imageDisplayUrl(): string {
  try {
    const stored = JSON.parse(localStorage.getItem('oe3-viewers') || '[]') as StoredViewer[];
    const ohif = stored.find((v) => v.id === 'ohif' && v.enabled && v.url);
    return ohif?.url || FALLBACK_VIEWER_URL;
  } catch {
    return FALLBACK_VIEWER_URL;
  }
}
