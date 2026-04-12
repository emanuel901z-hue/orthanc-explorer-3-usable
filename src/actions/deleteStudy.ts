import { studiesApi, type Study } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

export async function deleteStudyAction(study: Study, reason?: string): Promise<void> {
  const base = {
    action: "study.delete",
    resourceType: "study" as const,
    resourceId: study.ID,
    timestamp: new Date().toISOString(),
    reason,
  };
  try {
    await studiesApi.delete(study.ID);
    auditClient.emit({ ...base, outcome: "success" });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: "failure",
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
