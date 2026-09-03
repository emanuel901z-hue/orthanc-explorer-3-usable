/**
 * Typed wrappers for Orthanc peer endpoints.
 *
 * Covered:
 *   GET    /peers         — peersApi.list()
 *   PUT    /peers/:name   — peersApi.put()
 *   DELETE /peers/:name   — peersApi.delete()
 */
// src/api/peers.ts
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type PeerConfig = {
  Url: string;
  Username?: string;
  Password?: string;
};

export const peersApi = {
  /** GET /peers — Returns array of peer names (string[]). */
  list: () => orthancFetch<string[]>('/peers'),

  /** PUT /peers/:name — Creates or updates a peer. Body: PeerConfig. Returns 200 (void). */
  put: (name: string, body: PeerConfig) =>
    orthancFetch<void>(`/peers/${name}`, {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** DELETE /peers/:name — Removes a peer. Returns 200 (void). */
  delete: (name: string) => orthancFetch<void>(`/peers/${name}`, { method: 'DELETE' }),
};
