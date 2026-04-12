/**
 * Core DICOM data model types.
 * These represent the application-level domain objects, independent of
 * whether data comes from Orthanc REST, DICOMweb, or mock data.
 */

// ===== Patient =====
export interface Patient {
  id: string;
  name: string;
  birthDate?: Date;
  sex?: 'M' | 'F' | 'O';
}

// ===== Study =====
export interface Study {
  id: string;
  patientId: string;
  patientName: string;
  patientBirthDate?: Date;
  patientSex?: 'M' | 'F' | 'O';
  studyInstanceUID: string;
  studyDate: Date;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  modalities: string[];
  numberOfSeries: number;
  numberOfInstances: number;
  diskSize?: number;
  labels?: string[];
  isStable: boolean;
  lastUpdate: Date;
}

export interface StudyFilters {
  patientName?: string;
  patientId?: string;
  studyDateFrom?: Date;
  studyDateTo?: Date;
  accessionNumber?: string;
  studyDescription?: string;
  modalities?: string[];
}

// ===== Series =====
export interface Series {
  id: string;
  studyId: string;
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality: string;
  numberOfInstances: number;
}

// ===== Instance =====
export interface Instance {
  id: string;
  seriesId: string;
  sopInstanceUID: string;
  sopClassUID?: string;
  instanceNumber: number;
  fileSize: number;
  transferSyntax?: string;
  tags: DicomTag[];
}

export interface DicomTag {
  tag: string;
  name: string;
  vr: string;
  value: string;
}

// ===== Modality =====
export interface DicomModality {
  id: string;
  name: string;
  aet: string;
  host: string;
  port: number;
  manufacturer?: string;
  lastEcho?: Date;
  lastEchoStatus?: 'success' | 'failure';
}

// ===== DICOMweb Server =====
export interface DicomWebServer {
  id: string;
  name: string;
  url: string;
  authType: 'none' | 'basic' | 'bearer' | 'oauth';
  username?: string;
  clientId?: string;
  clientSecret?: string;
  hasQidoSupport: boolean;
  hasWadoSupport: boolean;
  hasStowSupport: boolean;
}

// ===== Upload =====
export interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error' | 'paused';
  error?: string;
}

// ===== Anonymization =====
export interface AnonymizationConfig {
  keepStudyDescription: boolean;
  keepSeriesDescription: boolean;
  newPatientName?: string;
  newPatientId?: string;
}

export interface DicomModifications {
  [tag: string]: string;
}
