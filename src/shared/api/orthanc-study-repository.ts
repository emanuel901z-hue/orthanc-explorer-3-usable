import { IStudyRepository } from './interfaces/study-repository.interface';
import {
  Study,
  StudyFilters,
  Series,
  Instance,
  DicomModifications,
  AnonymizationConfig,
} from '@/shared/types';
import { studiesApi } from '@/api/studies';
import { seriesApi } from '@/api/series';
import { instancesApi } from '@/api/instances';
import type { Study as OrthancStudy } from '@/api/studies';
import type { SeriesDetail } from '@/api/series';
import type { Instance as OrthancInstance } from '@/api/instances';

function mapOrthancStudy(s: OrthancStudy): Study {
  const tags = s.MainDicomTags ?? {};
  const patientTags = s.PatientMainDicomTags ?? {};

  const rawDate = tags['StudyDate'] ?? '';
  const studyDate = rawDate && rawDate.length >= 8
    ? new Date(
        parseInt(rawDate.slice(0, 4), 10),
        parseInt(rawDate.slice(4, 6), 10) - 1,
        parseInt(rawDate.slice(6, 8), 10)
      )
    : new Date(0);

  const rawBirth = patientTags['PatientBirthDate'] ?? '';
  const patientBirthDate = rawBirth && rawBirth.length >= 8
    ? new Date(
        parseInt(rawBirth.slice(0, 4), 10),
        parseInt(rawBirth.slice(4, 6), 10) - 1,
        parseInt(rawBirth.slice(6, 8), 10)
      )
    : undefined;

  const rawSex = patientTags['PatientSex'] ?? '';
  const patientSex: Study['patientSex'] =
    rawSex === 'M' ? 'M' : rawSex === 'F' ? 'F' : rawSex === 'O' ? 'O' : undefined;

  const rawModalities = tags['ModalitiesInStudy'] ?? tags['Modality'] ?? '';
  const modalities = rawModalities
    ? rawModalities.split('\\').filter(Boolean)
    : [];

  return {
    id: s.ID,
    patientId: patientTags['PatientID'] ?? '',
    patientName: patientTags['PatientName'] ?? '',
    patientBirthDate,
    patientSex,
    studyInstanceUID: tags['StudyInstanceUID'] ?? '',
    studyDate,
    studyTime: tags['StudyTime'] ?? undefined,
    studyDescription: tags['StudyDescription'] ?? undefined,
    accessionNumber: tags['AccessionNumber'] ?? undefined,
    modalities,
    numberOfSeries: s.Series?.length ?? 0,
    numberOfInstances: 0,
    isStable: true,
    lastUpdate: new Date(),
  };
}

function mapOrthancSeries(s: SeriesDetail): Series {
  const tags = s.MainDicomTags ?? {};
  return {
    id: s.ID,
    studyId: s.ParentStudy,
    seriesInstanceUID: tags['SeriesInstanceUID'] ?? '',
    seriesNumber: parseInt(tags['SeriesNumber'] ?? '0', 10),
    seriesDescription: tags['SeriesDescription'] ?? undefined,
    modality: tags['Modality'] ?? '',
    numberOfInstances: s.Instances?.length ?? 0,
  };
}

function mapOrthancInstance(inst: OrthancInstance): Instance {
  const tags = inst.MainDicomTags ?? {};
  return {
    id: inst.ID,
    seriesId: inst.ParentSeries,
    sopInstanceUID: tags['SOPInstanceUID'] ?? '',
    sopClassUID: tags['SOPClassUID'] ?? undefined,
    instanceNumber: parseInt(tags['InstanceNumber'] ?? '0', 10),
    fileSize: 0,
    tags: [],
  };
}

export class OrthancStudyRepository implements IStudyRepository {
  async findAll(filters?: StudyFilters): Promise<Study[]> {
    const query: Record<string, string> = {};

    if (filters?.patientName) query['PatientName'] = `*${filters.patientName}*`;
    if (filters?.patientId) query['PatientID'] = `*${filters.patientId}*`;
    if (filters?.accessionNumber) query['AccessionNumber'] = filters.accessionNumber;
    if (filters?.studyDescription) query['StudyDescription'] = `*${filters.studyDescription}*`;

    const results = await studiesApi.find({
      Level: 'Study',
      Query: query,
      Expand: true,
    });

    return results.map(mapOrthancStudy);
  }

  async findById(id: string): Promise<Study | null> {
    const study = await studiesApi.get(id);
    return mapOrthancStudy(study);
  }

  async getSeriesForStudy(studyId: string): Promise<Series[]> {
    const seriesList = await studiesApi.getSeries(studyId);
    return seriesList.map((s) => mapOrthancSeries(s as SeriesDetail));
  }

  async getSeriesById(seriesId: string): Promise<Series | null> {
    const s = await seriesApi.get(seriesId);
    return mapOrthancSeries(s);
  }

  async getInstancesForSeries(seriesId: string): Promise<Instance[]> {
    const instanceIds = await seriesApi.getInstances(seriesId);
    if (!Array.isArray(instanceIds)) return [];
    const instances = await Promise.all(
      (instanceIds as unknown as string[]).map((id) => instancesApi.get(id))
    );
    return instances.map(mapOrthancInstance);
  }

  async getInstanceById(instanceId: string): Promise<Instance | null> {
    const inst = await instancesApi.get(instanceId);
    return mapOrthancInstance(inst);
  }

  async delete(id: string): Promise<void> {
    await studiesApi.delete(id);
  }

  async modify(id: string, modifications: DicomModifications): Promise<Study> {
    await studiesApi.modify(id, { Replace: modifications });
    return this.findById(id) as Promise<Study>;
  }

  async anonymize(id: string, config: AnonymizationConfig): Promise<Study> {
    const body: Record<string, unknown> = {};
    if (config.keepStudyDescription) {
      body['Keep'] = ['StudyDescription'];
    }
    if (config.keepSeriesDescription) {
      const keep = (body['Keep'] as string[]) ?? [];
      body['Keep'] = [...keep, 'SeriesDescription'];
    }
    if (config.newPatientName) {
      body['Replace'] = { PatientName: config.newPatientName };
    }
    if (config.newPatientId) {
      body['Replace'] = { ...(body['Replace'] as Record<string, string> ?? {}), PatientID: config.newPatientId };
    }
    const result = await studiesApi.anonymize(id, body);
    return this.findById(result.ID) as Promise<Study>;
  }

  async sendToModality(id: string, modalityId: string): Promise<void> {
    await fetch(`/modalities/${modalityId}/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Resources: [id] }),
    });
  }

  async addLabel(id: string, label: string): Promise<void> {
    await fetch(`/studies/${id}/labels/${encodeURIComponent(label)}`, {
      method: 'PUT',
    });
  }

  async removeLabel(id: string, label: string): Promise<void> {
    await fetch(`/studies/${id}/labels/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    });
  }
}
