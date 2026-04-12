/**
 * Audit client stub.
 *
 * Emits structured audit events via the PHI-safe logger.
 * All fields are on the logger allowlist, preventing PHI leakage.
 *
 * Phase 2 note: Currently logs locally only.
 * Phase 5+: POST to /audit/events when the ATNA plugin is installed.
 */

import { logger } from "@/lib/logger";

export type AuditEvent = {
  action: string;
  resourceType: "study" | "series" | "instance" | "modality" | "dicomWebServer" | "peer";
  resourceId: string;
  outcome: "success" | "failure";
  timestamp: string;
  errorCode?: number;
  reason?: string;
  destinationId?: string;
};

export const auditClient = {
  emit(event: AuditEvent): void {
    logger.info("audit", {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      errorCode: event.errorCode,
    });
    // Phase 5+: POST to /audit/events when ATNA plugin is installed.
  },
};
