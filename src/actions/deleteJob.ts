/**
 * deleteJobAction — Audit-Seam für das Löschen eines Kopierauftrags.
 *
 * Orthanc erlaubt `DELETE /jobs/{id}` nur für **abgeschlossene** Jobs; ein
 * laufender muss vorher abgebrochen werden. Das ist endgültig: der Job und
 * seine DIMSE-Antwort verschwinden aus der Historie.
 *
 * Side effects:
 *   1. Calls jobsApi.delete(jobId) — irreversible.
 *   2. Emits an audit event (outcome: started | success | failure).
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { jobsApi } from '@/api/jobs';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function deleteJobAction(jobId: string): Promise<void> {
  const base = makeAuditBase('job.delete', 'job', jobId);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    await jobsApi.delete(jobId);
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
