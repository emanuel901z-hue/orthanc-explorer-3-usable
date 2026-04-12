import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { peersApi } from "./peers";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("peersApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("list() hits /peers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await peersApi.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/peers");
  });

  it("put() uses PUT method on /peers/:name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await peersApi.put("peer1", { Url: "http://peer1.example.com" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/peers/peer1");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("delete() uses DELETE method on /peers/:name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await peersApi.delete("peer1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/peers/peer1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
