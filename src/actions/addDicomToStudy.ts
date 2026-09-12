/**
 * addDicomToStudyAction — Upload real DICOM files and merge them into an existing study.
 *
 * Side effects:
 *   1. Calls instancesApi.upload() for each file.
 *   2. Discovers the Orthanc parent study for every uploaded instance.
 *   3. Pre-validates that source and target studies belong to the same patient
 *      before attempting Orthanc's /merge. Mismatched studies are reported
 *      instead of merged to avoid cross-patient data contamination.
 *   4. Merges compatible instances that landed in a different Orthanc study.
 *   5. Emits audit events for upload and merge.
 */
import { instancesApi } from '@/api/instances';
import { seriesApi } from '@/api/series';
import { studiesApi } from '@/api/studies';
import { mergeStudyAction } from '@/actions/mergeStudy';
import { makeAuditBase } from '@/actions/audit-base';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { newCorrelationId } from '@/lib/correlation';
import {
  getPatientSignature,
  patientSignaturesMatch,
  type PatientSignature,
} from '@/lib/dicom-patient-matching';

export interface AddDicomToStudyResult {
  uploaded: number;
  failed: number;
  merged: number;
  /** Source studies that were not merged because their patient differs from the target. */
  skipped: number;
  /** Orthanc IDs of source studies whose patient does not match the target. */
  mismatchedStudyIds: string[];
}

export async function addDicomToStudyAction(
  targetStudyId: string,
  files: File[],
  onProgress?: (completed: number, total: number) => void,
): Promise<AddDicomToStudyResult> {
  const base = makeAuditBase('study.addDicom', 'study', targetStudyId);
  auditClient.emit({ ...base, outcome: 'started', detail: { count: files.length } });

  // Pre-fetch target patient identity so we can reject cross-patient merges
  // before Orthanc throws an opaque error.
  const targetStudy = await studiesApi.get(targetStudyId);
  const targetPatient = getPatientSignature(targetStudy.PatientMainDicomTags);

  let uploaded = 0;
  let failed = 0;
  const sourceStudyIds = new Set<string>();
  const parentStudyCache = new Map<string, string>();
  const sourcePatients = new Map<string, PatientSignature>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const batchId = `add-dicom-${newCorrelationId()}`;
    const fileBase = makeAuditBase('instance.upload', 'instance', batchId);
    auditClient.emit({ ...fileBase, outcome: 'started' });

    try {
      const result = await instancesApi.upload(file);
      uploaded++;
      auditClient.emit({
        ...fileBase,
        outcome: 'success',
        resourceId: result.ID,
        detail: { batchId },
      });

      const instance = await instancesApi.get(result.ID);
      let parentStudy = parentStudyCache.get(instance.ParentSeries);
      if (!parentStudy) {
        const series = await seriesApi.get(instance.ParentSeries);
        parentStudy = series.ParentStudy;
        parentStudyCache.set(instance.ParentSeries, parentStudy);
      }

      if (parentStudy && parentStudy !== targetStudyId) {
        sourceStudyIds.add(parentStudy);
        if (!sourcePatients.has(parentStudy)) {
          const study = await studiesApi.get(parentStudy);
          sourcePatients.set(parentStudy, getPatientSignature(study.PatientMainDicomTags));
        }
      }
    } catch (e) {
      failed++;
      auditClient.emit({
        ...fileBase,
        outcome: 'failure',
        errorCode: e instanceof OrthancError ? e.status : undefined,
        detail: { batchId, error: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      onProgress?.(i + 1, files.length);
    }
  }

  // Separate merge-compatible source studies from mismatched patients.
  const mismatchedStudyIds: string[] = [];
  const mergeableSourceIds: string[] = [];
  for (const sourceId of sourceStudyIds) {
    const sourcePatient = sourcePatients.get(sourceId);
    if (sourcePatient && !patientSignaturesMatch(targetPatient, sourcePatient)) {
      mismatchedStudyIds.push(sourceId);
    } else {
      mergeableSourceIds.push(sourceId);
    }
  }

  let merged = 0;
  if (mergeableSourceIds.length > 0) {
    try {
      await mergeStudyAction(targetStudyId, mergeableSourceIds, false);
      merged = mergeableSourceIds.length;
      auditClient.emit({
        ...base,
        outcome: 'success',
        detail: {
          uploaded,
          failed,
          merged,
          skipped: mismatchedStudyIds.length,
          mismatchedStudyIds,
        },
      });
    } catch (e) {
      auditClient.emit({
        ...base,
        outcome: 'failure',
        detail: {
          uploaded,
          failed,
          sourceIds: mergeableSourceIds,
          skipped: mismatchedStudyIds.length,
          mismatchedStudyIds,
        },
      });
      throw e;
    }
  } else if (mismatchedStudyIds.length > 0) {
    // No merge was attempted, but there were uploads. Log a specific success
    // with mismatches so the audit trail is complete.
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        uploaded,
        failed,
        merged: 0,
        skipped: mismatchedStudyIds.length,
        mismatchedStudyIds,
      },
    });
  } else {
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: { uploaded, failed, merged: 0, skipped: 0 },
    });
  }

  return {
    uploaded,
    failed,
    merged,
    skipped: mismatchedStudyIds.length,
    mismatchedStudyIds,
  };
}
