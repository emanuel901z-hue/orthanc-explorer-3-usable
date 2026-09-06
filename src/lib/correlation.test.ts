import { describe, it, expect, vi, afterEach } from "vitest";
import { newCorrelationId } from "@/lib/correlation";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newCorrelationId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a UUIDv4-shaped string", () => {
    expect(newCorrelationId()).toMatch(UUID_V4_REGEX);
  });

  it("returns unique ids across calls", () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
  });

  // Regression test for the fallback chain: when crypto.randomUUID is
  // unavailable (non-secure HTTP context), the implementation must use
  // crypto.getRandomValues, NOT the weaker Math.random fallback.
  it("uses crypto.getRandomValues when crypto.randomUUID is unavailable", () => {
    const original = globalThis.crypto;
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 256;
      return arr;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    const id = newCorrelationId();
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(id).toMatch(UUID_V4_REGEX);

    vi.stubGlobal("crypto", original);
  });

  it("does NOT call Math.random when getRandomValues is available", () => {
    const randomSpy = vi.spyOn(Math, "random");
    const original = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    });
    newCorrelationId();
    expect(randomSpy).not.toHaveBeenCalled();
    vi.stubGlobal("crypto", original);
    randomSpy.mockRestore();
  });
});
