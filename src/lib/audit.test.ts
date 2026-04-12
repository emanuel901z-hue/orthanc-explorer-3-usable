import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { auditClient } from "@/lib/audit";
import { __setLoggerSinkForTests, __resetLoggerSinkForTests } from "@/lib/logger";

describe("auditClient", () => {
  const sink = vi.fn();
  beforeEach(() => { sink.mockClear(); __setLoggerSinkForTests(sink); });
  afterAll(() => __resetLoggerSinkForTests());

  it("emits audit events via the logger", () => {
    auditClient.emit({
      action: "study.delete",
      resourceType: "study",
      resourceId: "abc-123",
      outcome: "success",
      timestamp: "2026-04-11T00:00:00Z",
    });
    expect(sink).toHaveBeenCalledOnce();
    const event = sink.mock.calls[0][0];
    expect(event.event).toBe("audit");
    expect(event.fields.action).toBe("study.delete");
    expect(event.fields.outcome).toBe("success");
  });

  it("includes resourceType and resourceId in the log fields", () => {
    auditClient.emit({
      action: "series.delete",
      resourceType: "series",
      resourceId: "xyz-456",
      outcome: "failure",
      timestamp: "2026-04-11T01:00:00Z",
      errorCode: 403,
    });
    const event = sink.mock.calls[0][0];
    expect(event.fields.resourceType).toBe("series");
    expect(event.fields.resourceId).toBe("xyz-456");
    expect(event.fields.errorCode).toBe(403);
  });

  it("emits at info level", () => {
    auditClient.emit({
      action: "study.delete",
      resourceType: "study",
      resourceId: "abc-123",
      outcome: "success",
      timestamp: "2026-04-11T00:00:00Z",
    });
    expect(sink.mock.calls[0][0].level).toBe("info");
  });
});
