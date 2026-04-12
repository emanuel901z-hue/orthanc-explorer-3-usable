import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useFeature } from "./features";
import { loadConfig, __resetConfigForTests } from "./runtime";

describe("useFeature", () => {
  beforeEach(() => __resetConfigForTests());

  afterEach(() => {
    delete (window as unknown as { __OE3_CONFIG__?: unknown }).__OE3_CONFIG__;
    __resetConfigForTests();
  });

  it("returns true when no layers restrict", () => {
    (window as unknown as { __OE3_CONFIG__: unknown }).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: {},
    };
    loadConfig();
    const { result } = renderHook(() => useFeature("upload"));
    expect(result.current).toBe(true);
  });

  it("returns false when runtime disables", () => {
    (window as unknown as { __OE3_CONFIG__: unknown }).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: { upload: false },
    };
    loadConfig();
    const { result } = renderHook(() => useFeature("upload"));
    expect(result.current).toBe(false);
  });
});
