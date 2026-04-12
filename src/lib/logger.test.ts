import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { logger, __setLoggerSinkForTests, __resetLoggerSinkForTests } from "@/lib/logger";

describe("logger", () => {
  const sink = vi.fn();
  beforeEach(() => { sink.mockClear(); __setLoggerSinkForTests(sink); });
  afterAll(() => __resetLoggerSinkForTests());

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

  it("passes all allowlisted fields", () => {
    logger.info("test", { studyId: "s1", correlationId: "c1", status: 200 });
    const event = sink.mock.calls[0][0];
    expect(event.fields.studyId).toBe("s1");
    expect(event.fields.correlationId).toBe("c1");
    expect(event.fields.status).toBe(200);
  });

  it("drops all non-allowlisted fields", () => {
    logger.info("test", { patientName: "Jane", dob: "1970-01-01" });
    const event = sink.mock.calls[0][0];
    expect(Object.keys(event.fields)).toHaveLength(0);
  });

  it("drops nested object values for allowlisted keys (PHI leak prevention)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger.info("test", { studyId: { id: "abc", patientName: "Jane" } as any });
    const event = sink.mock.calls[0][0];
    expect(event.fields.studyId).toBeUndefined();
  });

  it("handles empty fields gracefully", () => {
    logger.warn("test.event");
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][0].level).toBe("warn");
    expect(sink.mock.calls[0][0].fields).toEqual({});
  });

  it("includes ISO 8601 timestamp", () => {
    logger.info("test", {});
    const event = sink.mock.calls[0][0];
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("emits warn level", () => {
    logger.warn("test.warn", { status: 503 });
    expect(sink.mock.calls[0][0].level).toBe("warn");
  });
});
