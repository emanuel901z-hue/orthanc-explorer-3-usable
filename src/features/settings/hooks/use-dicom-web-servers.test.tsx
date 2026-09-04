import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDicomWebServers } from "./use-dicom-web-servers";
import { dicomWebServersApi } from "@/api/dicomWebServers";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useDicomWebServers", () => {
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

  it("fetches DICOMweb servers via dicomWebServersApi.list and enriches with sidecar meta", async () => {
    const spy = vi.spyOn(dicomWebServersApi, "list").mockResolvedValue(["orthanc-wado", "ohif"]);
    const { result } = renderHook(() => useDicomWebServers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe("orthanc-wado");
    expect(result.current.data?.[1].name).toBe("ohif");
    // Sidecar metadata defaults when not present
    expect(result.current.data?.[0].authType).toBe("none");
    expect(result.current.data?.[0].hasQidoSupport).toBe(false);
  });
});
