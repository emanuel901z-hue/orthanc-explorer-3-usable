/**
 * Feature flags for toggling capabilities.
 * In production these could come from a remote config service.
 */

export interface FeatureFlags {
  /** Enable the DICOM viewer integration */
  viewer: boolean;
  /** Enable UPS worklist support */
  worklist: boolean;
  /** Enable the audit trail */
  auditTrail: boolean;
  /** Enable DICOMweb operations (QIDO/WADO/STOW) */
  dicomWeb: boolean;
  /** Enable study modification */
  studyModification: boolean;
  /** Enable anonymization */
  anonymization: boolean;
  /** Enable multi-language support */
  i18n: boolean;
}

export const featureFlags: Readonly<FeatureFlags> = Object.freeze({
  viewer: true,
  worklist: false,
  auditTrail: true,
  dicomWeb: true,
  studyModification: true,
  anonymization: true,
  i18n: true,
});
