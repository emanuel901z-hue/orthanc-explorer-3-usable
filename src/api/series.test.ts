import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { seriesApi } from "./series";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("seriesApi", () => {
  beforeEach(() => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("get() hits /series/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await seriesApi.get("ser-001");
    expect(fetchMock.mock.calls[0][0]).toBe("/series/ser-001");
  });

  it("getInstances() hits /series/:id/instances", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await seriesApi.getInstances("ser-001");
    expect(fetchMock.mock.calls[0][0]).toBe("/series/ser-001/instances");
  });

  it("delete() uses DELETE method on /series/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await seriesApi.delete("ser-001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/series/ser-001");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
