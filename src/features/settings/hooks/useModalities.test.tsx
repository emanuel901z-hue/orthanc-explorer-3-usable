import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useModalities } from "./useModalities";
import { modalitiesApi } from "@/api/modalities";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useModalities", () => {
  beforeEach(() => {
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

  it("fetches modalities via modalitiesApi.list", async () => {
    const spy = vi.spyOn(modalitiesApi, "list").mockResolvedValue(["STORESCU", "ECHOSCU"]);
    const { result } = renderHook(() => useModalities(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(result.current.data).toEqual(["STORESCU", "ECHOSCU"]);
  });
});
