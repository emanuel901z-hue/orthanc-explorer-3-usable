import { describe, it, expect, vi, beforeEach } from "vitest";
import { echoModalityAction } from "./echoModality";
import { modalitiesApi } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("echoModalityAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls modalitiesApi.echo, returns result, and emits success audit", async () => {
    const echoResult = { RemoteAET: "PEER", RemoteHost: "dicom-peer" };
    const apiSpy = vi
      .spyOn(modalitiesApi, "echo")
      .mockResolvedValue(echoResult);
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});

    const result = await echoModalityAction("TEST");

    expect(apiSpy).toHaveBeenCalledWith("TEST");
    expect(result).toEqual(echoResult);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "modality.echo",
        resourceType: "modality",
        resourceId: "TEST",
        outcome: "success",
      }),
    );
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(modalitiesApi, "echo").mockRejectedValue(
      new OrthancError(500, "c", "connection refused"),
    );
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});

    await expect(echoModalityAction("TEST")).rejects.toBeInstanceOf(
      OrthancError,
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failure", errorCode: 500 }),
    );
  });
});
