/**
 * deleteDicomWebServerAction — audit-seam wrapper for removing a DICOMweb server.
 *
 * Side effects:
 *   1. Calls dicomWebServersApi.delete(name) — removes the server from Orthanc.
 *   2. Removes the UI-only sidecar metadata from localStorage.
 *   3. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   4. Always rethrows on failure — callers must handle OrthancError.
 */
import { dicomWebServersApi, dicomWebServersMeta } from '@/api/dicomWebServers';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function deleteDicomWebServerAction(name: string): Promise<void> {
  const base = makeAuditBase('dicomweb.delete', 'dicomWebServer', name);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    await dicomWebServersApi.delete(name);
    dicomWebServersMeta.delete(name);
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
