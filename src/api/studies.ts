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
  MainDicomTags: Record<string, string>;
  PatientMainDicomTags: Record<string, string>;
  ParentPatient: string;
  Series: string[];
  Type: "Study";
};

export type Series = {
  ID: string;
  MainDicomTags: Record<string, string>;
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
