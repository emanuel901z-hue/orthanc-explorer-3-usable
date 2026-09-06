import { describe, it, expect, vi, beforeEach } from "vitest";
import { modifyStudyAction } from "./modifyStudy";
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("modifyStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls studiesApi.modify and emits started+success audit", async () => {
    vi.spyOn(studiesApi, "modify").mockResolvedValue({ ID: "new", Path: "/studies/new" });
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await modifyStudyAction("abc", { Replace: { PatientName: "Anonymous" } });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.modify",
      resourceId: "abc",
      outcome: "started",
    }));
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.modify",
      resourceId: "abc",
      outcome: "success",
    }));
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(studiesApi, "modify").mockRejectedValue(new OrthancError(500, "c", "boom"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await expect(modifyStudyAction("abc", {})).rejects.toBeInstanceOf(OrthancError);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure", errorCode: 500 }));
  });
});
