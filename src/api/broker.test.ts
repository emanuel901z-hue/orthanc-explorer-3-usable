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

  it("transforms.create() posts operations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":1}', { status: 201 }),
    );
    await brokerApi.transforms.create({
      name: "kh-prefix",
      enabled: true,
      priority: 10,
      source_id: null,
      target_id: null,
      operations: [{ op: "prefix", tag: "PatientID", value: "KH_" }],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/transforms");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.operations[0]).toMatchObject({ op: "prefix", tag: "PatientID" });
    expect(body.source_id).toBeNull();
  });

  it("transforms.update() PUTs to /api/v1/transforms/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":3}', { status: 200 }),
    );
    await brokerApi.transforms.update(3, {
      name: "x", enabled: false, priority: 5, source_id: 1, target_id: 2,
      operations: [{ op: "remove", tag: "PatientAddress" }],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/transforms/3");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("transforms.delete() DELETEs the rule", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await brokerApi.transforms.delete(4);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/transforms/4");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("settings.list() hits /api/v1/settings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await brokerApi.settings.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/settings");
  });

  it("settings.set() PUTs the value", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"key":"echo_interval_s","value":"45","source":"db"}', { status: 200 }),
    );
    const updated = await brokerApi.settings.set("echo_interval_s", "45");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/settings/echo_interval_s");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string).value).toBe("45");
    expect(updated.source).toBe("db");
  });

  it("settings.reset() DELETEs the override", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await brokerApi.settings.reset("allowed_calling_aets");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/settings/allowed_calling_aets");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("propagates non-2xx as OrthancError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":"nope"}', { status: 404 }),
    );
    await expect(brokerApi.targets.list()).rejects.toMatchObject({ status: 404 });
  });

  it("surfaces broker validation details (422) in the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '{"detail":["operation 1: unknown DICOM keyword \'Nope\'","operation 2: \'value\' is required"]}',
        { status: 422 },
      ),
    );
    await expect(brokerApi.transforms.create({
      name: "x", enabled: true, priority: 1, source_id: null, target_id: null,
      operations: [{ op: "set", tag: "Nope", value: "x" }],
    })).rejects.toThrow(/unknown DICOM keyword 'Nope'.*'value' is required/s);
  });

  it("keeps other error bodies scrubbed (no detail leakage)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":"internal secret path /etc/passwd"}', { status: 500 }),
    );
    await expect(brokerApi.status()).rejects.toThrow(/server encountered an error/i);
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
