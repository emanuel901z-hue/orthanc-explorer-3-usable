import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, __setLoggerSinkForTests } from "@/lib/logger";

describe("logger", () => {
  const sink = vi.fn();
  beforeEach(() => { sink.mockClear(); __setLoggerSinkForTests(sink); });

  it("emits structured events with allowlisted fields only", () => {
    logger.info("study.viewed", {
      studyId: "orthanc-uuid-123",
      patientName: "REDACT-ME",  // not on allowlist
      correlationId: "abc",
    });
    expect(sink).toHaveBeenCalledOnce();
    const event = sink.mock.calls[0][0];
    expect(event.event).toBe("study.viewed");
    expect(event.fields.studyId).toBe("orthanc-uuid-123");
    expect(event.fields.correlationId).toBe("abc");
    expect(event.fields.patientName).toBeUndefined();
  });

  it("records level", () => {
    logger.error("orthanc.fetch.failed", { status: 500 });
    expect(sink.mock.calls[0][0].level).toBe("error");
  });
});
