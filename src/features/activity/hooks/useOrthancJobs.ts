import { useQuery } from '@tanstack/react-query';
import { jobsApi, OrthancJob } from '@/api/jobs';

/**
 * Fetches all Orthanc jobs (expanded) every 3 seconds.
 * Returns jobs sorted by CreationTime descending (newest first).
 */
export function useOrthancJobs() {
  return useQuery<OrthancJob[]>({
    queryKey: ['orthanc-jobs-expanded'],
    queryFn: () => jobsApi.listExpanded(),
    refetchInterval: 3000,
    select: (data) => {
      if (!Array.isArray(data)) return [];
      return [...data].sort((a, b) => {
        const ta = a.CreationTime ? a.CreationTime : '';
        const tb = b.CreationTime ? b.CreationTime : '';
        return tb.localeCompare(ta);
      });
    },
  });
}
