import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useChanges } from "./useChanges";
import { changesApi } from "@/api/changes";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useChanges", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: {},
    };
    loadConfig();
  });

  afterEach(() => {
    __resetConfigForTests();
    vi.restoreAllMocks();
  });

  it("fetches changes via changesApi.list", async () => {
    const spy = vi.spyOn(changesApi, "list").mockResolvedValue({
      Changes: [],
      Done: true,
      First: 0,
      Last: 0,
    });
    const { result } = renderHook(() => useChanges(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
  });

  it("passes since and limit to changesApi.list", async () => {
    const spy = vi.spyOn(changesApi, "list").mockResolvedValue({
      Changes: [],
      Done: true,
      First: 0,
      Last: 10,
    });
    const { result } = renderHook(() => useChanges(5, 50), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ since: 5, limit: 50 });
  });
});
