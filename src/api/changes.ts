/**
 * Typed wrappers for Orthanc changes feed endpoints.
 *
 * Covered:
 *   GET /changes?since=...&limit=... — changesApi.list()
 *
 * Query params are only appended when provided; no trailing `?` on empty params.
 */
// src/api/changes.ts
import { orthancFetch } from "@/lib/client";

export type Change = {
  ChangeType: string;
  Date: string;
  ID: string;
  Path: string;
  ResourceType: "Patient" | "Study" | "Series" | "Instance";
  Seq: number;
};

export type ChangesResponse = {
  Changes: Change[];
  Done: boolean;
  Last: number;
};

export const changesApi = {
  list: ({ since, limit }: { since?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (since !== undefined) params.set("since", String(since));
    if (limit !== undefined) params.set("limit", String(limit));
    const qs = params.toString();
    const path = qs ? `/changes?${qs}` : "/changes";
    return orthancFetch<ChangesResponse>(path);
  },
};
