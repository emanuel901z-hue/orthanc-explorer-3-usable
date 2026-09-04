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
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';

export type OrthancFindQuery = {
  Level: 'Patient' | 'Study' | 'Series' | 'Instance';
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
  /** Orthanc 1.13.0+: UUID of the resource this was modified from (or null). */
  ModifiedFrom?: string | null;
  PatientMainDicomTags: Record<string, string | null>;
  ParentPatient: string;
  Series: string[];
  Type: 'Study';
  /** Computed tags returned when requested via ?requestedTags= or RequestedTags in /tools/find. */
  RequestedTags?: Record<string, string>;
};
/** @deprecated Use OrthancStudy instead. */
export type Study = OrthancStudy;

export type OrthancSeries = {
  ID: string;
  MainDicomTags: Record<string, string | null>;
  ParentStudy: string;
  Instances: string[];
  Type: 'Series';
};
/** @deprecated Use OrthancSeries instead. */
export type Series = OrthancSeries;

export const studiesApi = {
  /** POST /tools/find — Search resources. Body: OrthancFindQuery (Level, Query, Expand, RequestedTags). Returns OrthancStudy[] (when Level='Study'). PHI must stay in POST body. */
  find: (query: OrthancFindQuery) =>
    orthancFetch<OrthancStudy[]>('/tools/find', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(query),
    }),

  /** GET /studies/:id — Returns full OrthancStudy (ID, MainDicomTags, PatientMainDicomTags, Series, Labels, IsStable).
   *  Requests ModalitiesInStudy, BodyPartExamined, NumberOfStudyRelatedInstances/Series as computed tags. */
  get: (id: string) =>
    orthancFetch<OrthancStudy>(
      `/studies/${id}?requestedTags=ModalitiesInStudy;BodyPartExamined;NumberOfStudyRelatedInstances;NumberOfStudyRelatedSeries`,
    ),

  /** GET /studies/:id/series — Returns OrthancSeries[] (full objects with MainDicomTags, Instances, Status). */
  getSeries: (id: string) => orthancFetch<OrthancSeries[]>(`/studies/${id}/series`),

  /** DELETE /studies/:id — Deletes a study and all its series/instances. Returns 200 (void). */
  delete: (id: string) => orthancFetch<void>(`/studies/${id}`, { method: 'DELETE' }),

  /** POST /studies/:id/anonymize — Creates an anonymized copy. Body: { Remove, Replace, Keep }. Returns { ID, Path } of new resource. */
  anonymize: (id: string, body: Record<string, unknown> = {}) =>
    orthancFetch<{ ID: string; Path: string }>(`/studies/${id}/anonymize`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** POST /studies/:id/modify — Creates a modified copy. Body: { Replace, Remove }. Returns { ID, Path } of new resource. */
  modify: (id: string, body: Record<string, unknown>) =>
    orthancFetch<{ ID: string; Path: string }>(`/studies/${id}/modify`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(body),
    }),

  /** GET /studies/:id/archive — Downloads a ZIP archive of the study. Returns Blob (application/zip). */
  archive: (id: string) => orthancFetch<Blob>(`/studies/${id}/archive`, { responseType: 'blob' }),

  /** GET /studies/:id/statistics — Returns { CountInstances, CountSeries, DiskSize (string!), DiskSizeMB, ... }. */
  getStatistics: (id: string) =>
    orthancFetch<{
      CountInstances: number;
      CountSeries: number;
      DiskSize: string;
      DiskSizeMB: number;
      UncompressedSize: string;
      UncompressedSizeMB: number;
    }>(`/studies/${id}/statistics`),

  /** GET /studies/:id/shared-tags — Returns tags shared by ALL instances (study + patient level only). */
  getSharedTags: (id: string) =>
    orthancFetch<Record<string, unknown>>(`/studies/${id}/shared-tags`),

  /** POST /modalities/:name/store — Sends study to a DICOM modality via C-STORE. Body: { Resources: [studyId] }. Returns 200 (void). */
  sendToModality: (studyId: string, modalityId: string) =>
    orthancFetch<void>(`/modalities/${encodeURIComponent(modalityId)}/store`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ Resources: [studyId] }),
    }),

  /** PUT /studies/:id/labels/:label — Adds a label to the study. Returns 200 (void). */
  addLabel: (studyId: string, label: string) =>
    orthancFetch<void>(`/studies/${studyId}/labels/${encodeURIComponent(label)}`, {
      method: 'PUT',
    }),

  /** DELETE /studies/:id/labels/:label — Removes a label from the study. Returns 200 (void). */
  removeLabel: (studyId: string, label: string) =>
    orthancFetch<void>(`/studies/${studyId}/labels/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    }),

  /** POST /studies/:id/merge — Merges source studies/series into this target study.
   *  Body: { Resources: [sourceId, ...], KeepSource: boolean }.
   *  When KeepSource=false, source resources are deleted after merge.
   *  Returns { TargetStudy, MergedStudies } on success.
   */
  merge: (targetStudyId: string, sourceIds: string[], keepSource = false) =>
    orthancFetch<{ TargetStudy: string; MergedStudies: string[] }>(`/studies/${targetStudyId}/merge`, {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ Resources: sourceIds, KeepSource: keepSource }),
    }),
};
