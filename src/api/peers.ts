/**
 * Typed wrappers for Orthanc peer endpoints.
 *
 * Covered:
 *   GET    /peers         — peersApi.list()
 *   PUT    /peers/:name   — peersApi.put()
 *   DELETE /peers/:name   — peersApi.delete()
 */
// src/api/peers.ts
import { orthancFetch } from "@/lib/client";

export type PeerConfig = {
  Url: string;
  Username?: string;
  Password?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export const peersApi = {
  list: () => orthancFetch<string[]>("/peers"),

  put: (name: string, body: PeerConfig) =>
    orthancFetch<void>(`/peers/${name}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),

  delete: (name: string) =>
    orthancFetch<void>(`/peers/${name}`, { method: "DELETE" }),
};
