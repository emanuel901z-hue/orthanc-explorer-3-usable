/**
 * DICOMweb JSON response types (DICOM JSON format).
 * These types correspond to the QIDO-RS response structure defined in
 * DICOM PS3.18 (DICOMweb).
 */

/** A single DICOM JSON value element */
export interface DicomJsonValue {
  vr: string;
  Value?: Array<string | number | DicomJsonPersonName | DicomJsonElement>;
  BulkDataURI?: string;
  InlineBinary?: string;
}

/** Person name component in DICOM JSON */
export interface DicomJsonPersonName {
  Alphabetic?: string;
  Ideographic?: string;
  Phonetic?: string;
}

/** A DICOM JSON dataset — mapping from tag to value element */
export interface DicomJsonElement {
  [tag: string]: DicomJsonValue;
}

// ── QIDO-RS Response Types ────────────────────────────────

/** QIDO-RS study-level response (each array item is a DicomJsonElement) */
export type QidoStudyResponse = DicomJsonElement;

/** QIDO-RS series-level response */
export type QidoSeriesResponse = DicomJsonElement;

/** QIDO-RS instance-level response */
export type QidoInstanceResponse = DicomJsonElement;

// ── Common DICOM Tags (for typed access) ─────────────────

/** Well-known DICOM tag identifiers used in DICOMweb JSON responses */
export const DicomTags = {
  PatientName: '00100010',
  PatientID: '00100020',
  PatientBirthDate: '00100030',
  PatientSex: '00100040',
  StudyInstanceUID: '0020000D',
  StudyDate: '00080020',
  StudyTime: '00080030',
  StudyDescription: '00081030',
  AccessionNumber: '00080050',
  ModalitiesInStudy: '00080061',
  NumberOfStudyRelatedSeries: '00201206',
  NumberOfStudyRelatedInstances: '00201208',
  SeriesInstanceUID: '0020000E',
  SeriesNumber: '00200011',
  SeriesDescription: '0008103E',
  Modality: '00080060',
  NumberOfSeriesRelatedInstances: '00201209',
  SOPInstanceUID: '00080018',
  SOPClassUID: '00080016',
  InstanceNumber: '00200013',
  TransferSyntaxUID: '00020010',
} as const;

/**
 * Helper to extract a string value from a DICOM JSON element.
 */
export function getDicomStringValue(element: DicomJsonElement, tag: string): string | undefined {
  const val = element[tag];
  if (!val?.Value?.[0]) return undefined;
  const first = val.Value[0];
  if (typeof first === 'string') return first;
  if (typeof first === 'object' && 'Alphabetic' in first) return (first as DicomJsonPersonName).Alphabetic;
  return String(first);
}
