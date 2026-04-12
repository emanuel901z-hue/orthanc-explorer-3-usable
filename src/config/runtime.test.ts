// src/config/runtime.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, getConfig, OE3ConfigSchema } from "./runtime";

describe("runtime config", () => {
  afterEach(() => {
    delete (window as any).__OE3_CONFIG__;
  });

  it("parses a valid standalone config", () => {
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: "http://localhost:8042",
      authMode: "none",
      features: {},
    };
    const cfg = loadConfig();
    expect(cfg.orthancUrl).toBe("http://localhost:8042");
    expect(cfg.authMode).toBe("none");
  });

  it("defaults features to empty object", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none" };
    const cfg = loadConfig();
    expect(cfg.features).toEqual({});
  });

  it("accepts empty orthancUrl (plugin same-origin mode)", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    expect(() => loadConfig()).not.toThrow();
  });

  it("rejects invalid authMode", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "bogus", features: {} };
    expect(() => loadConfig()).toThrow();
  });

  it("getConfig throws before loadConfig is called", () => {
    expect(() => getConfig()).toThrow(/loadConfig/);
  });

  it("getConfig returns the loaded config after loadConfig", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
    expect(getConfig().authMode).toBe("none");
  });
});
