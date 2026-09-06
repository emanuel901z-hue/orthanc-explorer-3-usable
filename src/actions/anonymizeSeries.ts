/**
 * anonymizeSeriesAction — audit-seam wrapper for series anonymization.
 *
 * Side effects:
 *   1. Calls seriesApi.anonymize(seriesId, body) — POST /series/:id/anonymize.
 *   2. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 *
 * @param seriesId  Orthanc UUID of the series to anonymize.
 * @param body      Anonymization parameters ({ Remove, Replace, Keep }).
 */
import { seriesApi } from "@/api/series";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";

export async function anonymizeSeriesAction(
  seriesId: string,
  body: Record<string, unknown> = {},
): Promise<{ ID: string; Path: string }> {
  const base = makeAuditBase("series.anonymize", "series", seriesId);
  auditClient.emit({ ...base, outcome: "started" });
  try {
    const result = await seriesApi.anonymize(seriesId, body);
    auditClient.emit({ ...base, outcome: "success" });
    return result;
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: "failure",
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
