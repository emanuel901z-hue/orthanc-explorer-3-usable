import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteStudyAction } from "./deleteStudy";
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("deleteStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls studiesApi.delete and emits success audit", async () => {
    const apiSpy = vi.spyOn(studiesApi, "delete").mockResolvedValue(undefined);
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await deleteStudyAction({ ID: "abc", MainDicomTags: {}, PatientMainDicomTags: {}, ParentPatient: "", Series: [], Type: "Study" });
    expect(apiSpy).toHaveBeenCalledWith("abc");
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.delete",
      resourceId: "abc",
      outcome: "success",
    }));
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(studiesApi, "delete").mockRejectedValue(new OrthancError(500, "c", "boom"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(deleteStudyAction({ ID: "abc" } as any)).rejects.toBeInstanceOf(OrthancError);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "failure",
      errorCode: 500,
    }));
  });
});
