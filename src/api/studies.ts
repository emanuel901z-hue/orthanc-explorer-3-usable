/**
 * Typed wrappers for Orthanc study endpoints.
 *
 * Covered:
 *   GET  /studies/:id            — studiesApi.get()
 *   GET  /studies/:id/series     — studiesApi.getSeries()
 *   POST /tools/find             — studiesApi.find()   ← PHI MUST stay in POST body, never URL
 *   DELETE /studies/:id          — studiesApi.delete()
 *   POST /studies/:id/anonymize  — studiesApi.anonymize()
 *   POST /studies/:id/modify     — studiesApi.modify()
 *
 * PHI rule: All patient-identifying search criteria go in POST JSON bodies.
 * Never build query-string URLs from patient data.
 */
// src/api/studies.ts
import { orthancFetch } from "@/lib/client";

export type OrthancFindQuery = {
  Level: "Patient" | "Study" | "Series" | "Instance";
  Query: Record<string, string>;
  Limit?: number;
  Since?: number;
  Expand?: boolean;
};

export type Study = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  PatientMainDicomTags: Record<string, string | null>;
  ParentPatient: string;
  Series: string[];
  Type: "Study";
};

export type Series = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentStudy: string;
  Instances: string[];
  Type: "Series";
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export const studiesApi = {
  find: (query: OrthancFindQuery) =>
    orthancFetch<Study[]>("/tools/find", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(query),
    }),

  get: (id: string) => orthancFetch<Study>(`/studies/${id}`),

  getSeries: (id: string) => orthancFetch<Series[]>(`/studies/${id}/series`),

  delete: (id: string) =>
    orthancFetch<void>(`/studies/${id}`, { method: "DELETE" }),

  anonymize: (id: string, body: Record<string, unknown> = {}) =>
    orthancFetch<{ ID: string; Path: string }>(`/studies/${id}/anonymize`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),

  modify: (id: string, body: Record<string, unknown>) =>
    orthancFetch<{ ID: string; Path: string }>(`/studies/${id}/modify`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
};
