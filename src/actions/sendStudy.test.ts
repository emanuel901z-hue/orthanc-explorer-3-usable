import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendStudyAction } from "./sendStudy";
import { auditClient } from "@/lib/audit";

describe("sendStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs to modality store endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    // Must set up config first
    const { loadConfig, __resetConfigForTests } = await import("@/config/runtime");
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
    await sendStudyAction("study-abc", "modality", "REMOTE_AET");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/modalities/REMOTE_AET/store");
    // cleanup
    __resetConfigForTests();
  });

  it("POSTs to peer store endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    const { loadConfig, __resetConfigForTests } = await import("@/config/runtime");
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
    await sendStudyAction("study-abc", "peer", "PEER_A");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/peers/PEER_A/store");
    __resetConfigForTests();
  });
});
