import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { systemApi } from "@/api/system";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("systemApi", () => {
  beforeEach(() => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("get() hits /system", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Name: "OE3 Dev", Version: "1.12.4" }), { status: 200 }),
    );
    const data = await systemApi.get();
    expect(data.Name).toBe("OE3 Dev");
    expect(fetchMock.mock.calls[0][0]).toBe("/system");
  });

  it("stats() hits /statistics", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ CountStudies: 5 }), { status: 200 }),
    );
    await systemApi.stats();
    expect(fetchMock.mock.calls[0][0]).toBe("/statistics");
  });

  it("plugins() hits /plugins", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(["dicom-web"]), { status: 200 }),
    );
    const list = await systemApi.plugins();
    expect(list).toEqual(["dicom-web"]);
  });
});
