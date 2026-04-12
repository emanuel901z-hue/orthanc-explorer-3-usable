import { useQuery } from '@tanstack/react-query';
import { StudyFilters } from '@/shared/types';
import { RepositoryFactory } from '@/shared/api/repository-factory';

const repo = RepositoryFactory.createStudyRepository();

export function useStudies(filters: StudyFilters) {
  return useQuery({
    queryKey: ['studies', filters],
    queryFn: () => repo.findAll(filters),
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

export function useInstancePreview(instanceId: string) {
  return useQuery({
    queryKey: ['instance-preview', instanceId],
    queryFn: () => import('@/api/instances').then(({ instancesApi }) => instancesApi.getPreview(instanceId)),
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
}
