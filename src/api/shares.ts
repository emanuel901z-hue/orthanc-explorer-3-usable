/**
 * Typed wrappers for Orthanc Shares plugin endpoints.
 *
 * Covered (requires Orthanc Shares plugin):
 *   POST   /shares              — sharesApi.create()
 *   GET    /shares              — sharesApi.list()
 *   GET    /shares/:id          — sharesApi.get()
 *   DELETE /shares/:id          — sharesApi.delete()
 *
 * If the Shares plugin is not installed, these calls will return 404.
 */
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type Share = {
  ID: string;
  ResourceType: string;
  ResourceID: string;
  CreationTime: string;
  ExpirationTime?: string;
  RemainingDownloads?: number;
  Description?: string;
};

export type CreateShareBody = {
  ResourceID: string;
  ResourceType: 'Study' | 'Series' | 'Instance';
  ExpirationTime?: string;
  RemainingDownloads?: number;
  Description?: string;
};

export const sharesApi = {
  /** POST /shares — Creates a shareable link token for a resource. */
  create: (body: CreateShareBody) =>
    orthancFetch<Share>('/shares', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** GET /shares — Lists all shares. */
  list: () => orthancFetch<Share[]>('/shares'),

  /** GET /shares/:id — Gets share details. */
  get: (id: string) => orthancFetch<Share>(`/shares/${id}`),

  /** DELETE /shares/:id — Deletes a share. */
  delete: (id: string) => orthancFetch<void>(`/shares/${id}`, { method: 'DELETE' }),
};
