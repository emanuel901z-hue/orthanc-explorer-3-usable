/**
 * studyLabel actions — audit-seam wrappers for adding/removing study labels.
 *
 * Labels are linked to studyId which is PHI-adjacent — both operations
 * must be audited to maintain a complete healthcare write trail.
 *
 * Side effects per action:
 *   1. Calls studiesApi.addLabel / studiesApi.removeLabel
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function addLabelAction(studyId: string, label: string): Promise<void> {
  const base = makeAuditBase('study.label.add', 'study', studyId);
  try {
    await studiesApi.addLabel(studyId, label);
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

export async function removeLabelAction(studyId: string, label: string): Promise<void> {
  const base = makeAuditBase('study.label.remove', 'study', studyId);
  try {
    await studiesApi.removeLabel(studyId, label);
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
