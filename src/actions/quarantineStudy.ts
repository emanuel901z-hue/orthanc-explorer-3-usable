/**
 * quarantineStudyAction — audit-seam wrapper for putting a study into quarantine.
 *
 * Side effects:
 *   1. Calls pulmopathPacsApi.quarantineStudy() — the PP backend renames the
 *      study's PatientID to QRN-ADOPT-<timestamp> in place, so the Orthanc
 *      study id changes and the old URL is gone afterwards.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param studyId Orthanc UUID of the study to quarantine.
 * @param reason  Optional free-text reason (stored in the PP audit log).
 */
import { pulmopathPacsApi, type QuarantineResult } from '@/api/pulmopath-pacs';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function quarantineStudyAction(
  studyId: string,
  reason?: string,
): Promise<QuarantineResult> {
  const base = makeAuditBase('study.quarantine', 'study', studyId);
  auditClient.emit({ ...base, outcome: 'started', detail: { reason } });
  try {
    const result = await pulmopathPacsApi.quarantineStudy({ orthancStudyId: studyId, reason });
    auditClient.emit({
      ...base,
      outcome: 'success',
      detail: {
        reason,
        quarantinePatientId: result.quarantinePatientId,
        newOrthancStudyId: result.orthancStudyId,
      },
    });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
      detail: { reason },
    });
    throw e;
  }
}
