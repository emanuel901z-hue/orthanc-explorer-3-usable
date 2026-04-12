import { useQuery } from "@tanstack/react-query";
import { jobsApi } from "@/api/jobs";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
    refetchInterval: 5000,
  });
}
