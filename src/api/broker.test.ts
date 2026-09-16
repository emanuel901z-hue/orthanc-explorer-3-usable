import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { brokerApi } from "./broker";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const BROKER_CFG = {
  orthancUrl: "",
  brokerUrl: "/broker-api",
  authMode: "none" as const,
  features: {},
};

describe("brokerApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = BROKER_CFG;
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("status() hits broker base + /api/v1/status", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"scp_listening":true,"db_ok":true,"sources":[],"targets":[],"counts":{"queries":0,"stores":0,"seen_items":0}}', { status: 200 }),
    );
    const status = await brokerApi.status();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/status");
    expect(status.scp_listening).toBe(true);
  });

  it("sources.list() hits /api/v1/sources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await brokerApi.sources.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/sources");
  });

  it("sources.create() POSTs JSON", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":1}', { status: 201 }),
    );
    const body = {
      name: "ris-a", aet: "RIS_A", host: "ris.local", port: 11114,
      calling_aet: "MWLBROKER", charset: "ISO_IR 100",
      enabled: true, timeout_s: 10, priority: 10,
    };
    await brokerApi.sources.create(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/sources");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string).name).toBe("ris-a");
  });

  it("sources.echo() POSTs to /api/v1/sources/:id/echo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"ok":true,"rtt_ms":12}', { status: 200 }),
    );
    await brokerApi.sources.echo(7);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/sources/7/echo");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("rules.create() posts source/target ids", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":1}', { status: 201 }),
    );
    await brokerApi.rules.create({ source_id: 1, target_id: 2, priority: 10, enabled: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/rules");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ source_id: 1, target_id: 2 });
  });

  it("logs.queries() passes limit param", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await brokerApi.logs.queries(10);
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/logs/queries?limit=10");
  });

  it("propagates non-2xx as OrthancError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":"nope"}', { status: 404 }),
    );
    await expect(brokerApi.targets.list()).rejects.toMatchObject({ status: 404 });
  });
});

describe("brokerApi without brokerUrl", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("fails fast instead of calling fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(brokerApi.status()).rejects.toThrow("MWL broker is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
