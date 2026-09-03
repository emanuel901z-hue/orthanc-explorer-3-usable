/**
 * OrthancStudyRepository — IStudyRepository implementation backed by the live Orthanc API.
 *
 * Uses studiesApi, seriesApi, and instancesApi from @/api/* as the transport layer.
 * All patient-identifying searches go through POST /tools/find (PHI never in URL).
 */
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
import type { OrthancStudy } from '@/api/studies';
import type { SeriesDetail } from '@/api/series';
import type { OrthancInstance } from '@/api/instances';
import { mapDicomTagEntries, type RawDicomTag } from '@/lib/dicom-tag-utils';

/** Narrows a mixed Orthanc response to string IDs (vs. full instance objects). */
function isInstanceIdArray(arr: string[] | OrthancInstance[]): arr is string[] {
  return arr.length === 0 || typeof arr[0] === 'string';
}

function parseOrthancDate(raw: string | null | undefined): Date | undefined {
  if (!raw || raw.length < 8) return undefined;
  return new Date(
    parseInt(raw.slice(0, 4), 10),
    parseInt(raw.slice(4, 6), 10) - 1,
    parseInt(raw.slice(6, 8), 10),
  );
}

function parseOrthancDateTime(dateRaw: string | null | undefined): Date {
  return parseOrthancDate(dateRaw) ?? new Date(0);
}

function mapOrthancStudy(s: OrthancStudy): Study {
  const tags = s.MainDicomTags ?? {};
  const patientTags = s.PatientMainDicomTags ?? {};

  const rawSex = patientTags['PatientSex'] ?? '';
  const patientSex: Study['patientSex'] =
    rawSex === 'M' ? 'M' : rawSex === 'F' ? 'F' : rawSex === 'O' ? 'O' : undefined;

  // ModalitiesInStudy comes back when requested via RequestedTags; fall back
  // to Modality (series-level tag sometimes stored at study level).
  const rawModalities = tags['ModalitiesInStudy'] ?? tags['Modality'] ?? '';
  const modalities = rawModalities ? String(rawModalities).split('\\').filter(Boolean) : [];

  // Parse LastUpdate from Orthanc format "YYYYMMDDTHHmmss"
  const lastUpdate = s.LastUpdate
    ? new Date(
        `${s.LastUpdate.slice(0, 4)}-${s.LastUpdate.slice(4, 6)}-${s.LastUpdate.slice(6, 8)}T${s.LastUpdate.slice(9, 11)}:${s.LastUpdate.slice(11, 13)}:${s.LastUpdate.slice(13, 15)}`,
      )
    : new Date();

  const referringPhysician = tags['ReferringPhysicianName']
    ? tags['ReferringPhysicianName'].replace(/\^/g, ' ').trim() || undefined
    : undefined;

  return {
    id: s.ID,
    patientId: patientTags['PatientID'] ?? '',
    patientName: patientTags['PatientName'] ?? '',
    patientBirthDate: parseOrthancDate(patientTags['PatientBirthDate']),
    patientSex,
    studyInstanceUID: tags['StudyInstanceUID'] ?? '',
    studyDate: parseOrthancDateTime(tags['StudyDate']),
    studyTime: tags['StudyTime'] ?? undefined,
    studyDescription: tags['StudyDescription'] ?? undefined,
    accessionNumber: tags['AccessionNumber'] || undefined,
    referringPhysician,
    bodyPart: tags['BodyPartExamined'] ?? undefined,
    modalities,
    numberOfSeries: s.Series?.length ?? 0,
    // numberOfInstances is not available in list responses — fetched separately
    // via /statistics in findById. Consumers should treat undefined as "unknown".
    numberOfInstances: undefined,
    labels: s.Labels ?? [],
    isStable: s.IsStable ?? true,
    lastUpdate,
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
    bodyPartExamined: tags['BodyPartExamined'] ?? undefined,
    seriesDate: tags['SeriesDate'] ?? undefined,
    seriesTime: tags['SeriesTime'] ?? undefined,
    protocolName: tags['ProtocolName'] ?? undefined,
    numberOfInstances: s.Instances?.length ?? 0,
    firstInstanceId: s.Instances?.[0],
  };
}

function mapOrthancInstance(inst: OrthancInstance, rawTags?: Record<string, unknown>): Instance {
  const dicomTags = inst.MainDicomTags ?? {};
  return {
    id: inst.ID,
    seriesId: inst.ParentSeries,
    sopInstanceUID: dicomTags['SOPInstanceUID'] ?? '',
    instanceNumber: parseInt(dicomTags['InstanceNumber'] ?? '0', 10),
    fileSize: inst.FileSize ?? 0,
    imagePositionPatient: dicomTags['ImagePositionPatient'] ?? undefined,
    acquisitionTime: dicomTags['InstanceCreationTime'] ?? undefined,
    tags: rawTags ? mapDicomTagEntries(rawTags as Record<string, RawDicomTag>) : [],
  };
}

export class OrthancStudyRepository implements IStudyRepository {
  /** Searches studies via POST /tools/find. Filters are sent as JSON body. */
  async findAll(filters?: StudyFilters): Promise<Study[]> {
    const query: Record<string, string> = {};

    if (filters?.patientName) query['PatientName'] = `*${filters.patientName}*`;
    if (filters?.patientId) query['PatientID'] = `*${filters.patientId}*`;
    if (filters?.accessionNumber) query['AccessionNumber'] = filters.accessionNumber;
    if (filters?.studyDescription) query['StudyDescription'] = `*${filters.studyDescription}*`;

    const findBody: Record<string, unknown> = {
      Level: 'Study',
      Query: query,
      Expand: true,
      // Ask Orthanc to compute and include these tags even if not in MainDicomTags.
      // Requires Orthanc 1.11.0+ (orthancteam/orthanc:latest-full qualifies).
      RequestedTags: ['ModalitiesInStudy', 'BodyPartExamined'],
    };

    // Orthanc supports Labels filtering in /tools/find (AND logic: all labels must match)
    if (filters?.labels?.length) {
      findBody['Labels'] = filters.labels;
      findBody['LabelsConstraint'] = 'All';
    }

    const results = await studiesApi.find(findBody as Parameters<typeof studiesApi.find>[0]);

    const allStudies = results.map(mapOrthancStudy);

    // Orthanc's /tools/find doesn't reliably filter by ModalitiesInStudy on all
    // configurations, so apply the modality filter client-side using the already-
    // fetched ModalitiesInStudy values.
    if (filters?.modalities?.length) {
      return allStudies.filter((s) => s.modalities.some((m) => filters.modalities!.includes(m)));
    }

    return allStudies;
  }

  /** Returns a single study by Orthanc UUID, including instance count and disk size from statistics. */
  async findById(id: string): Promise<Study | null> {
    const [study, stats] = await Promise.all([
      studiesApi.get(id),
      studiesApi.getStatistics(id).catch(() => null),
    ]);
    const mapped = mapOrthancStudy(study);
    return {
      ...mapped,
      numberOfInstances: stats?.CountInstances ?? mapped.numberOfInstances,
      diskSize: stats?.DiskSize ?? mapped.diskSize,
    };
  }

  /** Returns all series belonging to a study. */
  async getSeriesForStudy(studyId: string): Promise<Series[]> {
    const seriesList = await studiesApi.getSeries(studyId);
    return seriesList.map((s) => mapOrthancSeries(s as SeriesDetail));
  }

  /** Returns a single series by Orthanc UUID. */
  async getSeriesById(seriesId: string): Promise<Series | null> {
    const s = await seriesApi.get(seriesId);
    return mapOrthancSeries(s);
  }

  /** Returns all instances in a series.
   *
   * Orthanc's GET /series/:id/instances returns either:
   *   - string[] of IDs (older Orthanc builds)
   *   - full instance objects[] (orthancteam/orthanc:latest-full)
   *
   * Handle both shapes so the UI works regardless of server version.
   */
  async getInstancesForSeries(seriesId: string): Promise<Instance[]> {
    const result = await seriesApi.getInstances(seriesId);
    if (!Array.isArray(result) || result.length === 0) return [];

    if (isInstanceIdArray(result)) {
      // Older Orthanc: array of ID strings — fetch each individually
      const instances = await Promise.all(result.map((id) => instancesApi.get(id)));
      return instances.map(mapOrthancInstance);
    }

    // Newer Orthanc: array of full instance objects — map directly
    return result.map(mapOrthancInstance);
  }

  /** Returns a single instance by Orthanc UUID, including all DICOM tags. */
  async getInstanceById(instanceId: string): Promise<Instance | null> {
    const [inst, rawTags] = await Promise.all([
      instancesApi.get(instanceId),
      instancesApi.getTags(instanceId),
    ]);
    return mapOrthancInstance(inst, rawTags as Record<string, unknown>);
  }

  /** Permanently deletes a study. Caller is responsible for audit. */
  async delete(id: string): Promise<void> {
    await studiesApi.delete(id);
  }

  /** Modifies DICOM tags on a study. */
  async modify(id: string, modifications: DicomModifications): Promise<Study> {
    await studiesApi.modify(id, { Replace: modifications });
    return this.findById(id) as Promise<Study>;
  }

  /** Returns an anonymized copy of the study. */
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
      body['Replace'] = {
        ...((body['Replace'] as Record<string, string>) ?? {}),
        PatientID: config.newPatientId,
      };
    }
    const result = await studiesApi.anonymize(id, body);
    return this.findById(result.ID) as Promise<Study>;
  }

  /** Sends a study to a DICOM modality via /modalities/{name}/store. */
  async sendToModality(id: string, modalityId: string): Promise<void> {
    await studiesApi.sendToModality(id, modalityId);
  }

  /** Adds a label to a study. */
  async addLabel(id: string, label: string): Promise<void> {
    await studiesApi.addLabel(id, label);
  }

  /** Removes a label from a study. */
  async removeLabel(id: string, label: string): Promise<void> {
    await studiesApi.removeLabel(id, label);
  }
}
