import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dicomWebServersApi } from "./dicomWebServers";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("dicomWebServersApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("list() hits /dicom-web/servers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await dicomWebServersApi.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/dicom-web/servers");
  });

  it("put() uses PUT method on /dicom-web/servers/:name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await dicomWebServersApi.put("wado1", { Url: "http://wado.example.com" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/dicom-web/servers/wado1");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("delete() uses DELETE method on /dicom-web/servers/:name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await dicomWebServersApi.delete("wado1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/dicom-web/servers/wado1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
