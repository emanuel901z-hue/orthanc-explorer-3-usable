import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { modalitiesApi } from "./modalities";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("modalitiesApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("list() hits /modalities", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await modalitiesApi.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/modalities");
  });

  it("get() hits /modalities/:name/configuration", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await modalitiesApi.get("MY_AET");
    expect(fetchMock.mock.calls[0][0]).toBe("/modalities/MY_AET/configuration");
  });

  it("put() uses PUT method on /modalities/:name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await modalitiesApi.put("MY_AET", { AET: "MY_AET", Host: "127.0.0.1", Port: 4242 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/modalities/MY_AET");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("delete() uses DELETE method on /modalities/:name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await modalitiesApi.delete("MY_AET");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/modalities/MY_AET");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("listExpanded() holt Name, AET, Host und Port in einem Aufruf", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ARCHIVE: { AET: "ARCHIVE", Host: "10.0.1.30", Port: 104 } }), {
        status: 200,
      }),
    );
    const expanded = await modalitiesApi.listExpanded();
    expect(fetchMock.mock.calls[0][0]).toBe("/modalities?expand");
    expect(expanded.ARCHIVE).toMatchObject({ AET: "ARCHIVE", Host: "10.0.1.30", Port: 104 });
  });

  it("echo() uses POST method on /modalities/:name/echo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await modalitiesApi.echo("MY_AET");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/modalities/MY_AET/echo");
    expect((init as RequestInit).method).toBe("POST");
  });
});
