/**
 * Typed client for the Orthanc REST API.
 * In demo mode, methods are not called — the DemoStudyRepository provides data directly.
 * When connected to a real Orthanc instance, all methods hit the Orthanc REST endpoints.
 */

import { HttpClient, type RequestOptions } from './http-client';
import type {
  OrthancStudyResponse,
  OrthancSeriesResponse,
  OrthancInstanceResponse,
  OrthancSystemInfo,
  OrthancStatistics,
  OrthancModalityEchoResult,
} from '@/shared/types/orthanc';
import type { AnonymizationConfig, DicomModifications } from '@/shared/types/dicom';

export interface OrthancClientConfig {
  baseUrl: string;
  authToken?: string;
}

export class OrthancClient {
  private http: HttpClient;

  constructor(config: OrthancClientConfig) {
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      authToken: config.authToken,
    });
  }

  setAuthToken(token: string | undefined): void {
    this.http.setAuthToken(token);
  }

  // ── System ──────────────────────────────────────────────

  async getSystemInfo(options?: RequestOptions): Promise<OrthancSystemInfo> {
    return this.http.get<OrthancSystemInfo>('/system', options);
  }

  async getStatistics(options?: RequestOptions): Promise<OrthancStatistics> {
    return this.http.get<OrthancStatistics>('/statistics', options);
  }

  // ── Studies ─────────────────────────────────────────────

  async listStudies(options?: RequestOptions): Promise<string[]> {
    return this.http.get<string[]>('/studies', options);
  }

  async getStudy(id: string, options?: RequestOptions): Promise<OrthancStudyResponse> {
    return this.http.get<OrthancStudyResponse>(`/studies/${id}`, options);
  }

  async deleteStudy(id: string, options?: RequestOptions): Promise<void> {
    return this.http.delete(`/studies/${id}`, options);
  }

  async modifyStudy(id: string, modifications: DicomModifications, options?: RequestOptions): Promise<OrthancStudyResponse> {
    return this.http.post<OrthancStudyResponse>(`/studies/${id}/modify`, {
      Replace: modifications,
    }, options);
  }

  async anonymizeStudy(id: string, config: AnonymizationConfig, options?: RequestOptions): Promise<OrthancStudyResponse> {
    return this.http.post<OrthancStudyResponse>(`/studies/${id}/anonymize`, {
      Keep: [
        ...(config.keepStudyDescription ? ['StudyDescription'] : []),
        ...(config.keepSeriesDescription ? ['SeriesDescription'] : []),
      ],
      Replace: {
        ...(config.newPatientName ? { PatientName: config.newPatientName } : {}),
        ...(config.newPatientId ? { PatientID: config.newPatientId } : {}),
      },
    }, options);
  }

  async sendStudyToModality(id: string, modalityId: string, options?: RequestOptions): Promise<void> {
    return this.http.post(`/modalities/${modalityId}/store`, [id], options);
  }

  async addStudyLabel(id: string, label: string, options?: RequestOptions): Promise<void> {
    return this.http.put(`/studies/${id}/labels/${label}`, undefined, options);
  }

  async removeStudyLabel(id: string, label: string, options?: RequestOptions): Promise<void> {
    return this.http.delete(`/studies/${id}/labels/${label}`, options);
  }

  // ── Series ──────────────────────────────────────────────

  async getStudySeries(studyId: string, options?: RequestOptions): Promise<string[]> {
    return this.http.get<string[]>(`/studies/${studyId}/series`, options);
  }

  async getSeries(id: string, options?: RequestOptions): Promise<OrthancSeriesResponse> {
    return this.http.get<OrthancSeriesResponse>(`/series/${id}`, options);
  }

  // ── Instances ───────────────────────────────────────────

  async getSeriesInstances(seriesId: string, options?: RequestOptions): Promise<string[]> {
    return this.http.get<string[]>(`/series/${seriesId}/instances`, options);
  }

  async getInstance(id: string, options?: RequestOptions): Promise<OrthancInstanceResponse> {
    return this.http.get<OrthancInstanceResponse>(`/instances/${id}`, options);
  }

  // ── Modalities ──────────────────────────────────────────

  async echoModality(modalityId: string, options?: RequestOptions): Promise<OrthancModalityEchoResult> {
    return this.http.post<OrthancModalityEchoResult>(`/modalities/${modalityId}/echo`, undefined, options);
  }

  // ── Tools ───────────────────────────────────────────────

  async findStudies(query: Record<string, string>, options?: RequestOptions): Promise<OrthancStudyResponse[]> {
    return this.http.post<OrthancStudyResponse[]>('/tools/find', {
      Level: 'Study',
      Query: query,
      Expand: true,
    }, options);
  }
}
