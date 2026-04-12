/**
 * Typed client for the DICOMweb protocol (QIDO-RS, WADO-RS, STOW-RS).
 * Accepts an injectable auth token for Bearer authentication.
 */

import { HttpClient, type RequestOptions } from './http-client';
import type {
  QidoStudyResponse,
  QidoSeriesResponse,
  QidoInstanceResponse,
  DicomJsonElement,
} from '@/shared/types/dicomweb';

export interface DicomWebClientConfig {
  baseUrl: string;
  authToken?: string;
}

export interface QidoQueryParams {
  PatientName?: string;
  PatientID?: string;
  StudyDate?: string;
  AccessionNumber?: string;
  ModalitiesInStudy?: string;
  StudyDescription?: string;
  limit?: number;
  offset?: number;
}

export class DicomWebClient {
  private http: HttpClient;

  constructor(config: DicomWebClientConfig) {
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      authToken: config.authToken,
      defaultHeaders: {
        Accept: 'application/dicom+json',
      },
    });
  }

  setAuthToken(token: string | undefined): void {
    this.http.setAuthToken(token);
  }

  // ── QIDO-RS (Query) ────────────────────────────────────

  async searchStudies(query?: QidoQueryParams, options?: RequestOptions): Promise<QidoStudyResponse[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (query) {
      if (query.PatientName) params['PatientName'] = query.PatientName;
      if (query.PatientID) params['PatientID'] = query.PatientID;
      if (query.StudyDate) params['StudyDate'] = query.StudyDate;
      if (query.AccessionNumber) params['AccessionNumber'] = query.AccessionNumber;
      if (query.ModalitiesInStudy) params['ModalitiesInStudy'] = query.ModalitiesInStudy;
      if (query.StudyDescription) params['StudyDescription'] = query.StudyDescription;
      if (query.limit !== undefined) params['limit'] = query.limit;
      if (query.offset !== undefined) params['offset'] = query.offset;
    }
    return this.http.get<QidoStudyResponse[]>('/studies', { ...options, params });
  }

  async searchSeries(studyInstanceUID: string, options?: RequestOptions): Promise<QidoSeriesResponse[]> {
    return this.http.get<QidoSeriesResponse[]>(`/studies/${studyInstanceUID}/series`, options);
  }

  async searchInstances(studyInstanceUID: string, seriesInstanceUID: string, options?: RequestOptions): Promise<QidoInstanceResponse[]> {
    return this.http.get<QidoInstanceResponse[]>(
      `/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances`,
      options,
    );
  }

  // ── WADO-RS (Retrieve) ─────────────────────────────────

  async retrieveStudy(studyInstanceUID: string, options?: RequestOptions): Promise<ArrayBuffer> {
    return this.http.get<ArrayBuffer>(`/studies/${studyInstanceUID}`, {
      ...options,
      headers: { Accept: 'multipart/related; type="application/dicom"', ...options?.headers },
    });
  }

  async retrieveStudyMetadata(studyInstanceUID: string, options?: RequestOptions): Promise<DicomJsonElement[]> {
    return this.http.get<DicomJsonElement[]>(`/studies/${studyInstanceUID}/metadata`, options);
  }

  async retrieveSeriesMetadata(studyInstanceUID: string, seriesInstanceUID: string, options?: RequestOptions): Promise<DicomJsonElement[]> {
    return this.http.get<DicomJsonElement[]>(
      `/studies/${studyInstanceUID}/series/${seriesInstanceUID}/metadata`,
      options,
    );
  }

  // ── STOW-RS (Store) ────────────────────────────────────

  /** Store DICOM instances. In a real implementation, body would be multipart/related. */
  async storeInstances(studyInstanceUID: string, _data: ArrayBuffer, options?: RequestOptions): Promise<unknown> {
    // TODO: Implement multipart/related STOW-RS upload
    return this.http.post(`/studies/${studyInstanceUID}`, undefined, {
      ...options,
      headers: { 'Content-Type': 'multipart/related; type="application/dicom"', ...options?.headers },
    });
  }
}
