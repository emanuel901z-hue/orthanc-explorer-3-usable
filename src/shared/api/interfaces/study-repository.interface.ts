import { Study, StudyFilters, Series, Instance, DicomModifications, AnonymizationConfig } from '@/shared/types';

export interface IStudyRepository {
  findAll(filters?: StudyFilters): Promise<Study[]>;
  findById(id: string): Promise<Study | null>;
  getSeriesForStudy(studyId: string): Promise<Series[]>;
  getSeriesById(seriesId: string): Promise<Series | null>;
  getInstancesForSeries(seriesId: string): Promise<Instance[]>;
  getInstanceById(instanceId: string): Promise<Instance | null>;
  delete(id: string): Promise<void>;
  modify(id: string, modifications: DicomModifications): Promise<Study>;
  anonymize(id: string, config: AnonymizationConfig): Promise<Study>;
  sendToModality(id: string, modalityId: string): Promise<void>;
  addLabel(id: string, label: string): Promise<void>;
  removeLabel(id: string, label: string): Promise<void>;
}
