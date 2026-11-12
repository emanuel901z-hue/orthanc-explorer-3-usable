/**
 * hideCopyJobsAction / showCopyJobsAction — Audit-Seam für das Ausblenden von
 * Kopieraufträgen in der Liste.
 *
 * Ausblenden ist keine Löschung: der Orthanc-Job bleibt in der Historie, nur
 * die Anzeige lässt ihn weg. Die Liste liegt im Ziele-Dienst, damit sie für
 * alle Benutzer gilt und einen Neustart übersteht.
 */
import { hiddenJobsApi } from '@/api/hidden-jobs';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

/** Ein einzelner Job steht im Protokoll mit ID, eine Auswahl mit Anzahl. */
function resourceId(jobIds: string[]): string {
  return jobIds.length === 1 ? jobIds[0] : `${jobIds.length} jobs`;
}

async function run(
  action: 'job.hide' | 'job.show',
  jobIds: string[],
  call: () => Promise<string[]>,
): Promise<string[]> {
  const base = makeAuditBase(action, 'job', resourceId(jobIds));
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    const hidden = await call();
    auditClient.emit({ ...base, outcome: 'success' });
    return hidden;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}

export function hideCopyJobsAction(jobIds: string[]): Promise<string[]> {
  return run('job.hide', jobIds, () => hiddenJobsApi.hide(jobIds));
}

export function showCopyJobsAction(jobIds: string[]): Promise<string[]> {
  return run('job.show', jobIds, () => hiddenJobsApi.show(jobIds));
}
