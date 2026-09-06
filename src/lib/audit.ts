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
  outcome: "started" | "success" | "failure";
  timestamp: string;
  errorCode?: number;
  reason?: string;
  destinationId?: string;
  /** Structured detail payload (e.g. merge source/target IDs, modify field deltas).
   *  NEVER logged client-side — may carry identifiers. Reserved for Phase 5+ ATNA POST. */
  detail?: Record<string, unknown>;
};

export const auditClient = {
  emit(event: AuditEvent): void {
    // Only PHI-safe scalar fields are routed through the logger allowlist.
    // `reason` and `detail` are intentionally NOT logged client-side — they may
    // carry patient identifiers (e.g. free-text delete reasons, modify deltas).
    // They are preserved on the AuditEvent for the future ATNA POST (Phase 5+),
    // which is server-side and runs through its own PHI scrubber.
    logger.info("audit", {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      errorCode: event.errorCode,
      destinationId: event.destinationId,
    });
    // Phase 5+: POST to /audit/events when ATNA plugin is installed.
  },
};
