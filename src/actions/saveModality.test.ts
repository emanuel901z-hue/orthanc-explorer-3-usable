import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveModalityAction } from "./saveModality";
import { modalitiesApi } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

const CONFIG = { AET: "TEST", Host: "dicom-peer", Port: 4242 };

describe("saveModalityAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls modalitiesApi.put and emits success audit", async () => {
    const apiSpy = vi.spyOn(modalitiesApi, "put").mockResolvedValue(undefined);
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});

    await saveModalityAction("TEST", CONFIG);

    expect(apiSpy).toHaveBeenCalledWith("TEST", CONFIG);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "modality.save",
        resourceType: "modality",
        resourceId: "TEST",
        outcome: "success",
      }),
    );
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(modalitiesApi, "put").mockRejectedValue(
      new OrthancError(409, "c", "conflict"),
    );
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});

    await expect(saveModalityAction("TEST", CONFIG)).rejects.toBeInstanceOf(
      OrthancError,
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failure", errorCode: 409 }),
    );
  });
});
