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

  // Regression test for the legacy `enableX` config.js key form shipped in
  // public/config.prod.js and documented in CLAUDE.md / AGENTS.md. Without
  // the FEATURE_ALIASES mapping, `cfg.features?.['delete'] === false` would
  // never match `enableDelete`, leaving all dangerous write actions enabled.
  it("returns false when runtime disables via legacy enableX key (enableDelete)", () => {
    (window as unknown as { __OE3_CONFIG__: unknown }).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: { enableDelete: false },
    };
    loadConfig();
    const { result } = renderHook(() => useFeature("delete"));
    expect(result.current).toBe(false);
  });

  it("returns false for enableAnonymize, enableModify, enableSendTo aliases", () => {
    (window as unknown as { __OE3_CONFIG__: unknown }).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: {
        enableAnonymize: false,
        enableModify: false,
        enableSendTo: false,
      },
    };
    loadConfig();
    expect(renderHook(() => useFeature("anonymize")).result.current).toBe(false);
    expect(renderHook(() => useFeature("modify")).result.current).toBe(false);
    expect(renderHook(() => useFeature("send")).result.current).toBe(false);
  });

  it("returns true for unrelated features when only enableDelete is disabled", () => {
    (window as unknown as { __OE3_CONFIG__: unknown }).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: { enableDelete: false },
    };
    loadConfig();
    // delete is disabled, but other write actions remain enabled
    expect(renderHook(() => useFeature("delete")).result.current).toBe(false);
    expect(renderHook(() => useFeature("modify")).result.current).toBe(true);
    expect(renderHook(() => useFeature("upload")).result.current).toBe(true);
  });
});
