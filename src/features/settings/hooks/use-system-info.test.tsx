import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSystemInfo, useStats, usePlugins } from "./use-system-info";
import { systemApi } from "@/api/system";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const mockSystem = {
  Name: "TestOrthanc",
  Version: "1.12.0",
  ApiVersion: 14,
  DatabaseVersion: 6,
  DicomAet: "ORTHANC",
  DicomPort: 4242,
  HttpPort: 8042,
  PluginsEnabled: true,
};

describe("useSystemInfo", () => {
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

  it("fetches system info via systemApi.get", async () => {
    const spy = vi.spyOn(systemApi, "get").mockResolvedValue(mockSystem);
    const { result } = renderHook(() => useSystemInfo(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(result.current.data?.Version).toBe("1.12.0");
  });

  it("fetches stats via systemApi.stats", async () => {
    const mockStats = {
      CountPatients: 10,
      CountStudies: 34,
      CountSeries: 307,
      CountInstances: 46539,
      TotalDiskSize: "18.48 GB",
    };
    const spy = vi.spyOn(systemApi, "stats").mockResolvedValue(mockStats);
    const { result } = renderHook(() => useStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(result.current.data?.CountStudies).toBe(34);
  });

  it("fetches plugins via systemApi.plugins", async () => {
    const spy = vi.spyOn(systemApi, "plugins").mockResolvedValue(["dicom-web", "ohif"]);
    const { result } = renderHook(() => usePlugins(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(result.current.data).toContain("dicom-web");
  });
});
