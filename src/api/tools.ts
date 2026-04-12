/**
 * Typed wrappers for Orthanc generic tools endpoints.
 *
 * Covered:
 *   POST /tools/lookup — toolsApi.lookup()
 */
// src/api/tools.ts
import { orthancFetch } from "@/lib/client";

export type LookupResult = {
  ID: string;
  Path: string;
  Type: "Patient" | "Study" | "Series" | "Instance";
};

export const toolsApi = {
  lookup: (body: string | Record<string, unknown>) =>
    orthancFetch<LookupResult>("/tools/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
