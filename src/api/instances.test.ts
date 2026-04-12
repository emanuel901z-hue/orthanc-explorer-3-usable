import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { instancesApi } from "./instances";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("instancesApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("get() hits /instances/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await instancesApi.get("inst-001");
    expect(fetchMock.mock.calls[0][0]).toBe("/instances/inst-001");
  });

  it("getTags() hits /instances/:id/tags", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await instancesApi.getTags("inst-001");
    expect(fetchMock.mock.calls[0][0]).toBe("/instances/inst-001/tags");
  });

  it("getPreview() hits /instances/:id/preview with Accept: image/png", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await instancesApi.getPreview("inst-001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/instances/inst-001/preview");
    expect((init as RequestInit & { headers: Headers }).headers.get("Accept")).toBe("image/png");
  });

  it("delete() uses DELETE method on /instances/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await instancesApi.delete("inst-001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/instances/inst-001");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("upload() POSTs /instances with Content-Type: application/dicom", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"ID":"new-inst","Status":"Success"}', { status: 200 }),
    );
    const file = new Blob(["dicom-data"], { type: "application/dicom" });
    await instancesApi.upload(file);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/instances");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit & { headers: Headers }).headers.get("Content-Type")).toBe("application/dicom");
  });
});
