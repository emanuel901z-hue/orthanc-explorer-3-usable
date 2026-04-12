import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { changesApi } from "./changes";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("changesApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("list({since, limit}) hits /changes?since=10&limit=5", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"Changes":[],"Done":true,"Last":0}', { status: 200 }),
    );
    await changesApi.list({ since: 10, limit: 5 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/changes");
    expect(url).toContain("since=10");
    expect(url).toContain("limit=5");
  });

  it("list({}) hits /changes with no trailing ?", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"Changes":[],"Done":true,"Last":0}', { status: 200 }),
    );
    await changesApi.list({});
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/changes");
  });
});
