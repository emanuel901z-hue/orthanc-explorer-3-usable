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
  list: () => orthancFetch<string[]>('/peers'),

  put: (name: string, body: PeerConfig) =>
    orthancFetch<void>(`/peers/${name}`, {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  delete: (name: string) => orthancFetch<void>(`/peers/${name}`, { method: 'DELETE' }),
};
