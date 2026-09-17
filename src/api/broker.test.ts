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

  it("rules.update()/delete() target the rule id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":5}', { status: 200 }),
    );
    await brokerApi.rules.update(5, { source_id: 1, target_id: 2, priority: 3, enabled: false });
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/rules/5");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PUT");

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await brokerApi.rules.delete(5);
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/rules/5");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("sources.resetBreaker() POSTs to the reset endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"source_id":3,"name":"ris-a","state":"closed","failures":0,"retry_in_s":null,"last_error":""}', { status: 200 }),
    );
    const result = await brokerApi.sources.resetBreaker(3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/broker-api/api/v1/sources/3/reset-breaker");
    expect((init as RequestInit).method).toBe("POST");
    expect(result.state).toBe("closed");
  });

  it("health.config() hits /api/v1/health/config", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"findings":[],"summary":{"error":0,"warning":0,"info":0}}', { status: 200 }),
    );
    const health = await brokerApi.health.config();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/health/config");
    expect(health.summary.error).toBe(0);
  });

  it("audit.config() builds the filter query", async () => {
    // a Response body can only be read once — hand out a fresh one per call
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("[]", { status: 200 })),
    );
    await brokerApi.audit.config({ entity: "source", limit: 25, offset: 50 });
    expect(fetchMock.mock.calls[0][0])
      .toBe("/broker-api/api/v1/audit/config?entity=source&limit=25&offset=50");

    await brokerApi.audit.config();
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/audit/config?limit=50");
  });

  it("audit.rollback() POSTs to the rollback endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"audit_id":7,"entity":"source","action":"restore","message":"ok"}', { status: 200 }),
    );
    const result = await brokerApi.audit.rollback(7);
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/config/rollback/7");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(result.action).toBe("restore");
  });

  it("config.export()/import() target the config endpoints", async () => {
    const doc = {
      schema_version: 1, sources: [], targets: [], rules: [], transforms: [], settings: {},
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(doc), { status: 200 })),
    );
    await brokerApi.config.export();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/config/export");

    fetchMock.mockImplementation(() => Promise.resolve(new Response(
      '{"schema_version":1,"dry_run":true,"changes":[],"skipped":[],"summary":{"create":0,"update":0,"skipped":0}}',
      { status: 200 },
    )));
    const plan = await brokerApi.config.import(doc as never, true);
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/config/import?dry_run=true");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(plan.dry_run).toBe(true);
  });

  it("simulate.route()/transform() POST the case", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response('{"accession":"ACC-1","study_uid":"","matched_via":"default","source_id":null,"source_name":null,"target_id":1,"target_name":"pacs","rule_id":null,"reason":"default","rules_applied":[],"changes":[],"errors":[]}', { status: 200 })),
    );
    await brokerApi.simulate.route({ accession: "ACC-1" });
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/simulate/route");

    await brokerApi.simulate.transform({ accession: "ACC-1", values: { PatientID: "P1" } });
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/simulate/transform");
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string))
      .toEqual({ accession: "ACC-1", values: { PatientID: "P1" } });
  });

  it("notify.events()/test() hit the alerting endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("[]", { status: 200 })),
    );
    await brokerApi.notify.events();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/notify/events");

    fetchMock.mockImplementation(() => Promise.resolve(
      new Response('{"ok":true,"error":""}', { status: 200 }),
    ));
    const result = await brokerApi.notify.test();
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/notify/test");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(result.ok).toBe(true);
  });

  it("cache.stats()/items()/clear() hit the cache endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("[]", { status: 200 })),
    );
    await brokerApi.cache.stats();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/cache/stats");

    await brokerApi.cache.items({ sourceId: 3, limit: 10 });
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/cache/items?source_id=3&limit=10");
    await brokerApi.cache.items();
    expect(fetchMock.mock.calls[2][0]).toBe("/broker-api/api/v1/cache/items?limit=100");

    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    await brokerApi.cache.clear();
    expect(fetchMock.mock.calls[3][0]).toBe("/broker-api/api/v1/cache");
    expect((fetchMock.mock.calls[3][1] as RequestInit).method).toBe("DELETE");

    await brokerApi.cache.clearSource(5);
    expect(fetchMock.mock.calls[4][0]).toBe("/broker-api/api/v1/cache/sources/5");
    expect((fetchMock.mock.calls[4][1] as RequestInit).method).toBe("DELETE");
  });

  it("transforms.list() hits /api/v1/transforms", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await brokerApi.transforms.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/transforms");
  });

  it("logs.stores() passes the limit param", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await brokerApi.logs.stores(7);
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/logs/stores?limit=7");
  });

  it("sources.update()/delete() target the source id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":9}', { status: 200 }),
    );
    await brokerApi.sources.update(9, {
      name: "ris-a", aet: "RIS_A", host: "h", port: 104,
      calling_aet: "MWLBROKER", charset: "ISO_IR 100",
      enabled: false, timeout_s: 10, priority: 10,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/sources/9");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PUT");

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await brokerApi.sources.delete(9);
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/sources/9");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("targets.update()/delete() target the target id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"id":4}', { status: 200 }),
    );
    await brokerApi.targets.update(4, {
      name: "pacs", aet: "PACS", host: "h", port: 104,
      calling_aet: "MWLBROKER", enabled: true, is_default: false,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/broker-api/api/v1/targets/4");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PUT");

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await brokerApi.targets.delete(4);
    expect(fetchMock.mock.calls[1][0]).toBe("/broker-api/api/v1/targets/4");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("falls back to the scrubbed message when an error body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>gateway error</html>", { status: 409 }),
    );
    await expect(brokerApi.sources.list()).rejects.toMatchObject({
      status: 409,
      message: "A conflict occurred.",
    });
  });

  it("maps network failures to a scrubbed OrthancError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection reset"));
    await expect(brokerApi.status()).rejects.toMatchObject({
      status: 0,
      message: "Network error. Please try again.",
    });
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
