import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { studiesApi } from "./studies";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("studiesApi", () => {
  beforeEach(() => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("find() POSTs /tools/find (PHI not in URL)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await studiesApi.find({ Level: "Study", Query: { PatientName: "Doe^Jane" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/tools/find");
    expect((init as RequestInit).method).toBe("POST");
    expect(url).not.toContain("Doe");  // PHI must not be in URL
    expect(JSON.parse((init as RequestInit).body as string).Query.PatientName).toBe("Doe^Jane");
  });

  it("get() hits /studies/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await studiesApi.get("abc-123");
    expect(fetchMock.mock.calls[0][0]).toBe("/studies/abc-123");
  });

  it("getSeries() hits /studies/:id/series", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await studiesApi.getSeries("abc-123");
    expect(fetchMock.mock.calls[0][0]).toBe("/studies/abc-123/series");
  });

  it("delete() uses DELETE method", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await studiesApi.delete("abc-123");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});
