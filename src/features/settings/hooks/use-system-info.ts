import { useQuery } from "@tanstack/react-query";
import { systemApi } from "@/api/system";

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system"],
    queryFn: () => systemApi.get(),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => systemApi.stats(),
  });
}

export function usePlugins() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: () => systemApi.plugins(),
  });
}
