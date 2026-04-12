import { describe, it, expect, vi, beforeEach } from "vitest";
import { modifyStudyAction } from "./modifyStudy";
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("modifyStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls studiesApi.modify and emits success audit", async () => {
    vi.spyOn(studiesApi, "modify").mockResolvedValue({ ID: "new", Path: "/studies/new" });
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    const study = { ID: "abc", MainDicomTags: {}, PatientMainDicomTags: {}, ParentPatient: "", Series: [], Type: "Study" as const };
    await modifyStudyAction(study, { Replace: { PatientName: "Anonymous" } });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.modify",
      resourceId: "abc",
      outcome: "success",
    }));
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(studiesApi, "modify").mockRejectedValue(new OrthancError(500, "c", "boom"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const study = { ID: "abc" } as any;
    await expect(modifyStudyAction(study, {})).rejects.toBeInstanceOf(OrthancError);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure", errorCode: 500 }));
  });
});
