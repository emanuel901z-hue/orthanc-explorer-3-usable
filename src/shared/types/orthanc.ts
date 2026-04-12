/**
 * Orthanc REST API response types.
 * These map directly to the JSON structures returned by the Orthanc server.
 */

export interface OrthancStudyResponse {
  ID: string;
  IsStable: boolean;
  LastUpdate: string;
  ParentPatient: string;
  PatientMainDicomTags: {
    PatientBirthDate?: string;
    PatientID: string;
    PatientName: string;
    PatientSex?: string;
  };
  MainDicomTags: {
    AccessionNumber?: string;
    StudyDate?: string;
    StudyDescription?: string;
    StudyID?: string;
    StudyInstanceUID: string;
    StudyTime?: string;
  };
  Series: string[];
  Labels: string[];
  Type: 'Study';
}

export interface OrthancSeriesResponse {
  ID: string;
  IsStable: boolean;
  LastUpdate: string;
  ParentStudy: string;
  MainDicomTags: {
    Modality: string;
    SeriesDescription?: string;
    SeriesInstanceUID: string;
    SeriesNumber?: string;
  };
  Instances: string[];
  Type: 'Series';
}

export interface OrthancInstanceResponse {
  ID: string;
  ParentSeries: string;
  MainDicomTags: {
    InstanceNumber?: string;
    SOPClassUID?: string;
    SOPInstanceUID: string;
  };
  FileSize: number;
  FileUuid: string;
  Type: 'Instance';
}

export interface OrthancSystemInfo {
  ApiVersion: number;
  DatabaseVersion: number;
  DicomAet: string;
  DicomPort: number;
  HttpPort: number;
  IsHttpServerSecure: boolean;
  Name: string;
  PluginsEnabled: boolean;
  StorageAreaPlugin?: string;
  Version: string;
}

export interface OrthancStatistics {
  CountInstances: number;
  CountPatients: number;
  CountSeries: number;
  CountStudies: number;
  TotalDiskSize: string;
  TotalDiskSizeMB: number;
  TotalUncompressedSize: string;
  TotalUncompressedSizeMB: number;
}

export interface OrthancModalityEchoResult {
  /** Empty object on success */
  [key: string]: unknown;
}

export interface OrthancPluginInfo {
  ID: string;
  Version: string;
  Description?: string;
  RootUri?: string;
}
