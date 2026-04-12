import type { AuditEvent } from '@/lib/audit';

/**
 * Builds the common audit event base object.
 * Extracted to eliminate duplication across action files.
 */
export function makeAuditBase(
  action: string,
  resourceType: AuditEvent['resourceType'],
  resourceId: string,
): Omit<AuditEvent, 'outcome' | 'errorCode' | 'reason'> {
  return {
    action,
    resourceType,
    resourceId,
    timestamp: new Date().toISOString(),
  };
}
