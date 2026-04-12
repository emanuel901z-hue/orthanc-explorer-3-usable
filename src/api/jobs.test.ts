import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jobsApi } from "./jobs";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("jobsApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("list() hits /jobs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await jobsApi.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/jobs");
  });

  it("get() hits /jobs/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await jobsApi.get("job-001");
    expect(fetchMock.mock.calls[0][0]).toBe("/jobs/job-001");
  });

  it("cancel() uses POST method on /jobs/:id/cancel", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await jobsApi.cancel("job-001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/jobs/job-001/cancel");
    expect((init as RequestInit).method).toBe("POST");
  });
});
