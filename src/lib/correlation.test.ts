import { describe, it, expect } from "vitest";
import { newCorrelationId } from "./correlation";

describe("newCorrelationId", () => {
  it("returns a UUIDv4-shaped string", () => {
    const id = newCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("returns unique ids across calls", () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
  });
});
