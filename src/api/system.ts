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
  /** Orthanc 1.13.0+ (API v31): whether labels are supported. */
  HasLabels?: boolean;
  /** Orthanc 1.13.0+ (API v31): feature capabilities for runtime detection. */
  Capabilities?: Record<string, boolean>;
};

export type OrthancStats = {
  CountPatients: number;
  CountStudies: number;
  CountSeries: number;
  CountInstances: number;
  /** Total disk size in bytes (as string — Orthanc returns bytes as string). */
  TotalDiskSize: string;
  TotalDiskSizeMB: number;
  TotalUncompressedSize: string;
  TotalUncompressedSizeMB: number;
};

export const systemApi = {
  /** GET /system — Returns OrthancSystem (Version, ApiVersion, DicomAet, HasLabels, Capabilities). */
  get: () => orthancFetch<OrthancSystem>("/system"),
  /** GET /statistics — Returns OrthancStats (CountPatients/Studies/Series/Instances, TotalDiskSize as string). */
  stats: () => orthancFetch<OrthancStats>("/statistics"),
  /** GET /plugins — Returns array of enabled plugin names (string[]). */
  plugins: () => orthancFetch<string[]>("/plugins"),
};
