import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadInstancesAction } from "./uploadInstances";
import { instancesApi } from "@/api/instances";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("uploadInstancesAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uploads all files and returns success count", async () => {
    vi.spyOn(instancesApi, "upload").mockResolvedValue({ ID: "x", Status: "Success" });
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    const files = [new File(["a"], "a.dcm"), new File(["b"], "b.dcm")];
    const result = await uploadInstancesAction(files);
    expect(result).toEqual({ succeeded: 2, failed: 0 });
    // BEFORE+AFTER audit: each file emits a "started" event before the upload
    // and a "success" event after — 2 files × 2 events = 4 calls.
    expect(auditSpy).toHaveBeenCalledTimes(4);
    // Verify the started/success pairing and that the success resourceId is
    // the Orthanc UUID (not the PHI-bearing filename).
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "started" }));
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success", resourceId: "x" }));
  });

  it("counts failures without rethrowing", async () => {
    vi.spyOn(instancesApi, "upload")
      .mockResolvedValueOnce({ ID: "x", Status: "Success" })
      .mockRejectedValueOnce(new OrthancError(413, "c", "too large"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    const files = [new File(["a"], "a.dcm"), new File(["b"], "b.dcm")];
    const result = await uploadInstancesAction(files);
    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure", errorCode: 413 }));
  });
});
