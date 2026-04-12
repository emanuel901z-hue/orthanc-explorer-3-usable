import { IStudyRepository } from '../interfaces/study-repository.interface';
import {
  Study,
  StudyFilters,
  Series,
  Instance,
  DicomModifications,
  AnonymizationConfig,
} from '@/shared/types';
import {
  generateDemoStudies,
  generateDemoSeries,
  generateDemoInstances,
} from './demo-data-generator';
import { logger } from '@/lib/logger';

export class DemoStudyRepository implements IStudyRepository {
  private studies: Study[] = generateDemoStudies(120);

  async findAll(filters?: StudyFilters): Promise<Study[]> {
    let results = [...this.studies];

    if (filters) {
      if (filters.patientName) {
        const q = filters.patientName.toLowerCase();
        results = results.filter((s) => s.patientName.toLowerCase().includes(q));
      }
      if (filters.patientId) {
        const q = filters.patientId.toLowerCase();
        results = results.filter((s) => s.patientId.toLowerCase().includes(q));
      }
      if (filters.accessionNumber) {
        const q = filters.accessionNumber.toLowerCase();
        results = results.filter((s) => s.accessionNumber?.toLowerCase().includes(q));
      }
      if (filters.studyDescription) {
        const q = filters.studyDescription.toLowerCase();
        results = results.filter((s) => s.studyDescription?.toLowerCase().includes(q));
      }
      if (filters.modalities && filters.modalities.length > 0) {
        results = results.filter((s) => s.modalities.some((m) => filters.modalities!.includes(m)));
      }
      if (filters.studyDateFrom) {
        results = results.filter((s) => s.studyDate >= filters.studyDateFrom!);
      }
      if (filters.studyDateTo) {
        results = results.filter((s) => s.studyDate <= filters.studyDateTo!);
      }
    }

    return results.sort((a, b) => b.studyDate.getTime() - a.studyDate.getTime());
  }

  async findById(id: string): Promise<Study | null> {
    return this.studies.find((s) => s.id === id) ?? null;
  }

  async getSeriesForStudy(studyId: string): Promise<Series[]> {
    const study = this.studies.find((s) => s.id === studyId);
    if (!study) return [];
    return generateDemoSeries(studyId, study.modalities[0], study.numberOfSeries);
  }

  async getSeriesById(seriesId: string): Promise<Series | null> {
    // Parse seriesId pattern: series-{studyId}-{index}
    const match = seriesId.match(/^series-(.+)-(\d+)$/);
    if (!match) return null;
    const studyId = match[1];
    const study = this.studies.find((s) => s.id === studyId);
    if (!study) return null;
    const allSeries = generateDemoSeries(studyId, study.modalities[0], study.numberOfSeries);
    return allSeries.find((s) => s.id === seriesId) ?? null;
  }

  async getInstancesForSeries(seriesId: string): Promise<Instance[]> {
    const series = await this.getSeriesById(seriesId);
    if (!series) return [];
    return generateDemoInstances(seriesId, series.modality, series.numberOfInstances);
  }

  async getInstanceById(instanceId: string): Promise<Instance | null> {
    // Parse instanceId pattern: instance-{seriesId}-{index}
    const match = instanceId.match(/^instance-(series-.+)-(\d+)$/);
    if (!match) return null;
    const seriesId = match[1];
    const instances = await this.getInstancesForSeries(seriesId);
    return instances.find((i) => i.id === instanceId) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.studies = this.studies.filter((s) => s.id !== id);
  }

  async modify(id: string, _modifications: DicomModifications): Promise<Study> {
    const study = this.studies.find((s) => s.id === id);
    if (!study) throw new Error('Study not found');
    return study;
  }

  async anonymize(id: string, config: AnonymizationConfig): Promise<Study> {
    const study = this.studies.find((s) => s.id === id);
    if (!study) throw new Error('Study not found');
    const anon = {
      ...study,
      patientName: config.newPatientName || 'ANONYMOUS',
      patientId: config.newPatientId || 'ANON',
    };
    return anon;
  }

  async sendToModality(id: string, _modalityId: string): Promise<void> {
    logger.info('demo.sendToModality', { resourceId: id });
  }

  async addLabel(id: string, label: string): Promise<void> {
    const index = this.studies.findIndex((s) => s.id === id);
    if (index !== -1 && !this.studies[index].labels?.includes(label)) {
      this.studies[index] = {
        ...this.studies[index],
        labels: [...(this.studies[index].labels ?? []), label],
      };
    }
  }

  async removeLabel(id: string, label: string): Promise<void> {
    const index = this.studies.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.studies[index] = {
        ...this.studies[index],
        labels: this.studies[index].labels?.filter((l) => l !== label),
      };
    }
  }
}
