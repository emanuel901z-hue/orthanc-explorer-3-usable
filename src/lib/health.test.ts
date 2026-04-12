import { describe, it, expect, beforeEach } from "vitest";
import { healthTracker } from "@/lib/health";

describe("healthTracker", () => {
  beforeEach(() => healthTracker.reset());

  it("starts healthy", () => {
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
});
