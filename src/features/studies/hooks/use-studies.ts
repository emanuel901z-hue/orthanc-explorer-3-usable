import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { StudyFilters } from '@/shared/types';
import { RepositoryFactory } from '@/shared/api/repository-factory';

const repo = RepositoryFactory.createStudyRepository();

export function useStudies(filters: StudyFilters) {
  return useQuery({
    queryKey: ['studies', filters],
    queryFn: () => repo.findAll(filters),
    // Keep showing the last successful data while a new filter query is in-flight.
    // Without this, every keystroke clears the table and shows skeleton rows (perceived freeze).
    placeholderData: keepPreviousData,
  });
}

export function useStudy(id: string) {
  return useQuery({
    queryKey: ['study', id],
    queryFn: () => repo.findById(id),
    enabled: !!id,
  });
}

export function useStudySeries(studyId: string) {
  return useQuery({
    queryKey: ['study-series', studyId],
    queryFn: () => repo.getSeriesForStudy(studyId),
    enabled: !!studyId,
  });
}

export function useSeries(seriesId: string) {
  return useQuery({
    queryKey: ['series', seriesId],
    queryFn: () => repo.getSeriesById(seriesId),
    enabled: !!seriesId,
  });
}

export function useSeriesInstances(seriesId: string) {
  return useQuery({
    queryKey: ['series-instances', seriesId],
    queryFn: () => repo.getInstancesForSeries(seriesId),
    enabled: !!seriesId,
  });
}

export function useInstance(instanceId: string) {
  return useQuery({
    queryKey: ['instance', instanceId],
    queryFn: () => repo.getInstanceById(instanceId),
    enabled: !!instanceId,
  });
}

export function useSeriesSharedTags(seriesId: string) {
  return useQuery({
    queryKey: ['series-shared-tags', seriesId],
    queryFn: async () => {
      const { seriesApi } = await import('@/api/series');
      const raw = await seriesApi.getSharedTags(seriesId);
      return Object.entries(raw as Record<string, { Name?: string; Type?: string; Value?: string | null }>).map(
        ([tag, v]) => ({
          tag,
          name: v.Name ?? tag,
          vr: v.Type ?? '',
          value: v.Value == null ? '' : typeof v.Value === 'string' ? v.Value : JSON.stringify(v.Value),
        })
      );
    },
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudySharedTags(studyId: string) {
  return useQuery({
    queryKey: ['study-shared-tags', studyId],
    queryFn: async () => {
      const { studiesApi } = await import('@/api/studies');
      const raw = await studiesApi.getSharedTags(studyId);
      // Map to DicomTagEntry[] — same shape used by DicomTagBrowser
      return Object.entries(raw as Record<string, { Name?: string; Type?: string; Value?: string | null }>).map(
        ([tag, v]) => ({
          tag,
          name: v.Name ?? tag,
          vr: v.Type ?? '',
          value: v.Value == null ? '' : typeof v.Value === 'string' ? v.Value : JSON.stringify(v.Value),
        })
      );
    },
    enabled: !!studyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInstanceTransferSyntax(instanceId: string) {
  return useQuery({
    queryKey: ['instance-transfer-syntax', instanceId],
    queryFn: () =>
      import('@/api/instances').then(({ instancesApi }) =>
        instancesApi.getMetadata(instanceId, 'TransferSyntax')
      ),
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInstancePreview(instanceId: string) {
  return useQuery({
    queryKey: ['instance-preview', instanceId],
    queryFn: () => import('@/api/instances').then(({ instancesApi }) => instancesApi.getPreview(instanceId)),
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
}
