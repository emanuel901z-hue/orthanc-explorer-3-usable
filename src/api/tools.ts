/**
 * Typed wrappers for Orthanc generic tools endpoints.
 *
 * Covered:
 *   POST /tools/lookup — toolsApi.lookup()
 */
// src/api/tools.ts
import { orthancFetch } from "@/lib/client";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type LookupResult = {
  ID: string;
  Path: string;
  Type: "Patient" | "Study" | "Series" | "Instance";
};

export const toolsApi = {
  lookup: (body: string | Record<string, unknown>) =>
    orthancFetch<LookupResult>("/tools/lookup", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
};
