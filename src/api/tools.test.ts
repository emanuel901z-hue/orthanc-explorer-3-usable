import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toolsApi } from "./tools";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("toolsApi", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("lookup() uses POST to /tools/lookup", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"ID":"abc","Path":"/studies/abc","Type":"Study"}', { status: 200 }),
    );
    await toolsApi.lookup("1.2.3.4.5");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/tools/lookup");
    expect((init as RequestInit).method).toBe("POST");
  });
});
