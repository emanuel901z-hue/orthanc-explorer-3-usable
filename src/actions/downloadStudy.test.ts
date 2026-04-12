import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadStudyAction } from "./downloadStudy";
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("downloadStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls archive and triggers download link", async () => {
    const blob = new Blob(["ZIP"], { type: "application/zip" });
    vi.spyOn(studiesApi, "archive").mockResolvedValue(blob);
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    // Mock DOM APIs
    const createObjectURL = vi.fn().mockReturnValue("blob:fake");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, writable: true });
    const clickSpy = vi.fn();
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => { (el as HTMLAnchorElement).click = clickSpy; return el; });
    vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);
    await downloadStudyAction("abc-123");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success", action: "study.download" }));
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(studiesApi, "archive").mockRejectedValue(new OrthancError(500, "c", "boom"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await expect(downloadStudyAction("abc-123")).rejects.toBeInstanceOf(OrthancError);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure" }));
  });
});
