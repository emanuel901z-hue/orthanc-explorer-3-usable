import { useQuery } from "@tanstack/react-query";
import { changesApi } from "@/api/changes";

export function useChanges(since?: number, limit = 100) {
  return useQuery({
    queryKey: ["changes", since, limit],
    queryFn: () => changesApi.list({ since, limit }),
    refetchInterval: 5000,
  });
}
