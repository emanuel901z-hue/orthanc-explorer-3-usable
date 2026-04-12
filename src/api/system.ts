/**
 * system.ts — Typed wrappers for Orthanc system-level REST endpoints.
 *
 * Covers:
 *   GET /system       → OrthancSystem
 *   GET /statistics   → OrthancStats
 *   GET /plugins      → string[]
 *
 * No business logic lives here — this module is a pure typed transport layer
 * over orthancFetch. Callers (hooks, pages, health checks) own any caching,
 * error handling, or derived state.
 */

import { orthancFetch } from "@/lib/client";

export type OrthancSystem = {
  Name: string;
  Version: string;
  ApiVersion: number;
  DatabaseVersion: number;
  DicomAet: string;
  DicomPort: number;
  HttpPort: number;
  PluginsEnabled: boolean;
};

export type OrthancStats = {
  CountPatients: number;
  CountStudies: number;
  CountSeries: number;
  CountInstances: number;
  TotalDiskSize: string;
};

export const systemApi = {
  get: () => orthancFetch<OrthancSystem>("/system"),
  stats: () => orthancFetch<OrthancStats>("/statistics"),
  plugins: () => orthancFetch<string[]>("/plugins"),
};
