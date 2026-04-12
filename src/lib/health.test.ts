import { describe, it, expect, beforeEach } from "vitest";
import { healthTracker } from "@/lib/health";

describe("healthTracker", () => {
  beforeEach(() => healthTracker.reset());

  it("starts with status unknown", () => {
    expect(healthTracker.getState().status).toBe("unknown");
  });
  it("becomes degraded after consecutive failures", () => {
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    expect(healthTracker.getState().status).toBe("degraded");
  });
  it("returns to healthy after a success", () => {
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    healthTracker.record(true, 200);
    expect(healthTracker.getState().status).toBe("healthy");
  });
  it("notifies subscribers on state change", () => {
    const states: string[] = [];
    const unsub = healthTracker.subscribe((s) => states.push(s.status));
    healthTracker.recordFailure(); healthTracker.recordFailure(); healthTracker.recordFailure();
    unsub();
    expect(states).toContain("degraded");
  });

  it("does not degrade before reaching the failure threshold", () => {
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    expect(healthTracker.getState().status).not.toBe("degraded");
    expect(healthTracker.getState().consecutiveFailures).toBe(2);
  });

  it("record(false) counts as a failure and triggers degradation", () => {
    healthTracker.record(false, 500);
    healthTracker.record(false, 500);
    healthTracker.record(false, 500);
    expect(healthTracker.getState().status).toBe("degraded");
  });

  it("unsubscribed listener no longer receives notifications", () => {
    const calls: string[] = [];
    const unsub = healthTracker.subscribe((s) => calls.push(s.status));
    healthTracker.recordFailure();
    unsub();
    const countAfterUnsub = calls.length;
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    expect(calls.length).toBe(countAfterUnsub);
  });
});
