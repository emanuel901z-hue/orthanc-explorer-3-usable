import { describe, it, expect, vi, beforeEach } from "vitest";
import { anonymizeStudyAction } from "./anonymizeStudy";
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("anonymizeStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls studiesApi.anonymize and emits started+success audit", async () => {
    vi.spyOn(studiesApi, "anonymize").mockResolvedValue({ ID: "new", Path: "/studies/new" });
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await anonymizeStudyAction("abc", {});
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.anonymize",
      resourceId: "abc",
      outcome: "started",
    }));
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.anonymize",
      resourceId: "abc",
      outcome: "success",
    }));
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(studiesApi, "anonymize").mockRejectedValue(new OrthancError(500, "c", "boom"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await expect(anonymizeStudyAction("abc", {})).rejects.toBeInstanceOf(OrthancError);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure", errorCode: 500 }));
  });
});
