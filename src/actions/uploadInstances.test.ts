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
    expect(auditSpy).toHaveBeenCalledTimes(2);
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
