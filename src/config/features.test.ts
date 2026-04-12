import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveFeature } from "./features";
import { __resetConfigForTests, loadConfig } from "./runtime";

const setCfg = (features: Record<string, boolean> = {}) => {
  (window as unknown as { __OE3_CONFIG__: unknown }).__OE3_CONFIG__ = {
    orthancUrl: "",
    authMode: "none",
    features,
  };
  loadConfig();
};

describe("resolveFeature", () => {
  beforeEach(() => __resetConfigForTests());

  afterEach(() => {
    delete (window as unknown as { __OE3_CONFIG__?: unknown }).__OE3_CONFIG__;
    __resetConfigForTests();
  });

  it("defaults to enabled when no layer objects", () => {
    setCfg();
    expect(resolveFeature("upload", { profile: null, scopes: null })).toBe(true);
  });

  it("returns false when runtime config disables", () => {
    setCfg({ upload: false });
    expect(resolveFeature("upload", { profile: null, scopes: null })).toBe(false);
  });

  it("returns false when profile lacks permission", () => {
    setCfg();
    expect(
      resolveFeature("upload", {
        profile: { permissions: ["delete"] },
        scopes: null,
      }),
    ).toBe(false);
  });

  it("returns true when profile has permission", () => {
    setCfg();
    expect(
      resolveFeature("upload", {
        profile: { permissions: ["upload"] },
        scopes: null,
      }),
    ).toBe(true);
  });

  it("intersects all layers (AND semantics)", () => {
    setCfg({ upload: true });
    expect(
      resolveFeature("upload", {
        profile: { permissions: ["upload"] },
        scopes: ["patient/ImagingStudy.read"],
      }),
    ).toBe(false); // scope doesn't include write
  });

  it("allows write features when scope is ImagingStudy.write", () => {
    setCfg();
    expect(
      resolveFeature("upload", {
        profile: { permissions: ["upload"] },
        scopes: ["patient/ImagingStudy.write"],
      }),
    ).toBe(true);
  });

  it("allows read features under ImagingStudy.read scope", () => {
    setCfg();
    expect(
      resolveFeature("download", {
        profile: { permissions: ["download"] },
        scopes: ["patient/ImagingStudy.read"],
      }),
    ).toBe(true);
  });

  it("wildcard ImagingStudy.* satisfies both read and write checks", () => {
    setCfg();
    expect(
      resolveFeature("upload", {
        profile: { permissions: ["upload"] },
        scopes: ["user/ImagingStudy.*"],
      }),
    ).toBe(true);
    expect(
      resolveFeature("download", {
        profile: { permissions: ["download"] },
        scopes: ["user/ImagingStudy.*"],
      }),
    ).toBe(true);
  });
});
