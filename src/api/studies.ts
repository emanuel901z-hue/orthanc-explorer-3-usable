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
  /** Orthanc 1.11.0+: ask server to compute and include extra tags (e.g. ModalitiesInStudy). */
  RequestedTags?: string[];
};

export type OrthancStudy = {
  ID: string;
  IsStable: boolean;
  Labels: string[];
  LastUpdate: string;
  MainDicomTags: Record<string, string | null>;
  PatientMainDicomTags: Record<string, string | null>;
  ParentPatient: string;
  Series: string[];
  Type: "Study";
};
/** @deprecated Use OrthancStudy instead. */
export type Study = OrthancStudy;

export type OrthancSeries = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentStudy: string;
  Instances: string[];
  Type: "Series";
};
/** @deprecated Use OrthancSeries instead. */
export type Series = OrthancSeries;

const JSON_HEADERS = { "Content-Type": "application/json" };

export const studiesApi = {
  find: (query: OrthancFindQuery) =>
    orthancFetch<OrthancStudy[]>("/tools/find", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(query),
    }),

  get: (id: string) => orthancFetch<OrthancStudy>(`/studies/${id}`),

  getSeries: (id: string) => orthancFetch<OrthancSeries[]>(`/studies/${id}/series`),

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

  archive: (id: string) =>
    orthancFetch<Blob>(`/studies/${id}/archive`, { responseType: "blob" }),

  getStatistics: (id: string) =>
    orthancFetch<{ CountInstances: number; DiskSize: number }>(`/studies/${id}/statistics`),

  /** Returns tags shared by ALL instances in the study — study + patient level only. */
  getSharedTags: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/studies/${id}/shared-tags`),

  sendToModality: (studyId: string, modalityId: string) =>
    orthancFetch<void>(`/modalities/${encodeURIComponent(modalityId)}/store`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ Resources: [studyId] }),
    }),

  addLabel: (studyId: string, label: string) =>
    orthancFetch<void>(`/studies/${studyId}/labels/${encodeURIComponent(label)}`, {
      method: 'PUT',
    }),

  removeLabel: (studyId: string, label: string) =>
    orthancFetch<void>(`/studies/${studyId}/labels/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    }),
};
