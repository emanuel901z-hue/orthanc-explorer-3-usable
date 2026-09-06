/**
 * Returns a new UUIDv4 string suitable for use as an X-Request-Id header value.
 *
 * Uses crypto.randomUUID() when available (secure contexts: HTTPS or localhost).
 * Falls back to a manual RFC 4122 v4 implementation for non-secure HTTP contexts
 * (e.g. internal network deployments where HTTPS is terminated at a reverse proxy
 * and the SPA is served over plain HTTP to the browser).
 *
 * Note: crypto.getRandomValues is available in ALL browser contexts (secure and
 * non-secure), so the Math.random fallback is intentionally omitted — correlation
 * IDs must not degrade to non-cryptographic randomness when getRandomValues exists.
 */
export function newCorrelationId(): string {
  // crypto.randomUUID is only defined in secure contexts (HTTPS or localhost).
  // In non-secure HTTP contexts (e.g. http://10.0.1.46:3080), it is undefined.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: manual UUIDv4 using crypto.getRandomValues (available in all contexts).
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }

  // Defensive last resort — should be unreachable in any browser context.
  // Kept only to avoid a hard crash in exotic runtimes (e.g. stripped crypto shims).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
