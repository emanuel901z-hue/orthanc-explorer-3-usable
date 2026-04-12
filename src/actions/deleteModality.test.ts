import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteModalityAction } from "./deleteModality";
import { modalitiesApi } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("deleteModalityAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls modalitiesApi.delete and emits success audit", async () => {
    const apiSpy = vi
      .spyOn(modalitiesApi, "delete")
      .mockResolvedValue(undefined);
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});

    await deleteModalityAction("TEST");

    expect(apiSpy).toHaveBeenCalledWith("TEST");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "modality.delete",
        resourceType: "modality",
        resourceId: "TEST",
        outcome: "success",
      }),
    );
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(modalitiesApi, "delete").mockRejectedValue(
      new OrthancError(404, "c", "not found"),
    );
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});

    await expect(deleteModalityAction("TEST")).rejects.toBeInstanceOf(
      OrthancError,
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failure", errorCode: 404 }),
    );
  });
});
