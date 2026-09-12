import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/instances', () => ({
  instancesApi: {
    upload: vi.fn(),
    get: vi.fn(),
  },
}));
vi.mock('@/api/series', () => ({
  seriesApi: {
    get: vi.fn(),
  },
}));
vi.mock('@/api/studies', () => ({
  studiesApi: {
    get: vi.fn(),
  },
}));
vi.mock('@/actions/mergeStudy', () => ({
  mergeStudyAction: vi.fn(),
}));
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { addDicomToStudyAction } from './addDicomToStudy';
import { instancesApi, type OrthancInstance } from '@/api/instances';
import { seriesApi, type OrthancSeries } from '@/api/series';
import { studiesApi, type OrthancStudy } from '@/api/studies';
import { mergeStudyAction } from '@/actions/mergeStudy';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';

function makeStudy(
  id: string,
  patientId: string,
  patientName: string,
  birthDate: string,
): OrthancStudy {
  return {
    ID: id,
    IsStable: true,
    Labels: [],
    LastUpdate: '',
    MainDicomTags: {},
    ParentPatient: `pat-${id}`,
    PatientMainDicomTags: {
      PatientID: patientId,
      PatientName: patientName,
      PatientBirthDate: birthDate,
    },
    Series: [],
    Type: 'Study',
  };
}

function makeInstance(id: string, parentSeries: string): OrthancInstance {
  return { ID: id, MainDicomTags: {}, ParentSeries: parentSeries, Type: 'Instance' };
}

function makeSeries(id: string, parentStudy: string): OrthancSeries {
  return { ID: id, MainDicomTags: {}, ParentStudy: parentStudy, Instances: [], Type: 'Series' };
}

describe('addDicomToStudyAction', () => {
  const targetStudyId = 'target-study';
  const targetPatient = { PatientID: 'DEMO-001', PatientName: 'Patient^Demo001', PatientBirthDate: '19680427' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));

    vi.mocked(studiesApi.get).mockImplementation(async (id: string) => {
      if (id === targetStudyId) {
        return makeStudy(targetStudyId, targetPatient.PatientID, targetPatient.PatientName, targetPatient.PatientBirthDate);
      }
      return makeStudy(id, 'OTHER-001', 'Other^Patient', '19700101');
    });
  });

  afterEach(() => vi.useRealTimers());

  it('uploads files and merges source studies with the same patient', async () => {
    const files = [new File(['a'], '1.dcm'), new File(['b'], '2.dcm')];
    const uploadedInstanceId = 'inst-1';
    const sourceSeriesId = 'source-series';
    const sourceStudyId = 'source-study';

    vi.mocked(instancesApi.upload).mockResolvedValue({ ID: uploadedInstanceId, Status: 'Success' });
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance(uploadedInstanceId, sourceSeriesId));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries(sourceSeriesId, sourceStudyId));
    vi.mocked(studiesApi.get).mockImplementation(async (id: string) => {
      if (id === targetStudyId) return makeStudy(targetStudyId, 'DEMO-001', 'Patient^Demo001', '19680427');
      if (id === sourceStudyId) return makeStudy(sourceStudyId, 'DEMO-001', 'Patient^Demo001', '19680427');
      return makeStudy(id, 'OTHER-001', 'Other^Patient', '19700101');
    });
    vi.mocked(mergeStudyAction).mockResolvedValue({ TargetStudy: targetStudyId, MergedStudies: [sourceStudyId] });

    const result = await addDicomToStudyAction(targetStudyId, files);

    expect(result).toEqual({ uploaded: 2, failed: 0, merged: 1, skipped: 0, mismatchedStudyIds: [] });
    expect(mergeStudyAction).toHaveBeenCalledWith(targetStudyId, [sourceStudyId], false);
    expect(auditClient.emit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'study.addDicom',
      outcome: 'success',
      detail: expect.objectContaining({ merged: 1, skipped: 0 }),
    }));
  });

  it('merges source studies with umlaut spelling variants of the same patient', async () => {
    const files = [new File(['a'], '1.dcm')];
    const uploadedInstanceId = 'inst-1';
    const sourceSeriesId = 'source-series';
    const sourceStudyId = 'source-study';

    vi.mocked(instancesApi.upload).mockResolvedValue({ ID: uploadedInstanceId, Status: 'Success' });
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance(uploadedInstanceId, sourceSeriesId));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries(sourceSeriesId, sourceStudyId));
    vi.mocked(studiesApi.get).mockImplementation(async (id: string) => {
      if (id === targetStudyId) return makeStudy(targetStudyId, '', 'Müller^Hans-Peter', '19680427');
      if (id === sourceStudyId) return makeStudy(sourceStudyId, '', 'Mueller^Hans-P', '1968-04-27');
      return makeStudy(id, 'OTHER-001', 'Other^Patient', '19700101');
    });
    vi.mocked(mergeStudyAction).mockResolvedValue({ TargetStudy: targetStudyId, MergedStudies: [sourceStudyId] });

    const result = await addDicomToStudyAction(targetStudyId, files);

    expect(result).toEqual({ uploaded: 1, failed: 0, merged: 1, skipped: 0, mismatchedStudyIds: [] });
    expect(mergeStudyAction).toHaveBeenCalledWith(targetStudyId, [sourceStudyId], false);
  });

  it('does not merge source studies with a different patient and reports them as skipped', async () => {
    const files = [new File(['a'], '1.dcm')];
    const uploadedInstanceId = 'inst-1';
    const sourceSeriesId = 'source-series';
    const sourceStudyId = 'source-study';

    vi.mocked(instancesApi.upload).mockResolvedValue({ ID: uploadedInstanceId, Status: 'Success' });
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance(uploadedInstanceId, sourceSeriesId));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries(sourceSeriesId, sourceStudyId));
    vi.mocked(mergeStudyAction).mockResolvedValue({ TargetStudy: targetStudyId, MergedStudies: [sourceStudyId] });

    const result = await addDicomToStudyAction(targetStudyId, files);

    expect(result).toEqual({ uploaded: 1, failed: 0, merged: 0, skipped: 1, mismatchedStudyIds: [sourceStudyId] });
    expect(mergeStudyAction).not.toHaveBeenCalled();
  });

  it('does not merge when uploads already land in the target study', async () => {
    const files = [new File(['a'], '1.dcm')];
    const uploadedInstanceId = 'inst-1';
    const targetSeriesId = 'target-series';

    vi.mocked(instancesApi.upload).mockResolvedValue({ ID: uploadedInstanceId, Status: 'Success' });
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance(uploadedInstanceId, targetSeriesId));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries(targetSeriesId, targetStudyId));

    const result = await addDicomToStudyAction(targetStudyId, files);

    expect(result).toEqual({ uploaded: 1, failed: 0, merged: 0, skipped: 0, mismatchedStudyIds: [] });
    expect(mergeStudyAction).not.toHaveBeenCalled();
  });

  it('counts upload failures and does not attempt merge', async () => {
    const files = [new File(['a'], '1.dcm'), new File(['b'], '2.dcm')];

    vi.mocked(instancesApi.upload)
      .mockResolvedValueOnce({ ID: 'inst-1', Status: 'Success' })
      .mockRejectedValueOnce(new OrthancError(413, 'c', 'too large'));
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance('inst-1', 'series-1'));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries('series-1', targetStudyId));

    const result = await addDicomToStudyAction(targetStudyId, files);

    expect(result).toEqual({ uploaded: 1, failed: 1, merged: 0, skipped: 0, mismatchedStudyIds: [] });
    expect(mergeStudyAction).not.toHaveBeenCalled();
    expect(auditClient.emit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'instance.upload',
      outcome: 'failure',
      errorCode: 413,
    }));
  });

  it('calls onProgress after each upload', async () => {
    const files = [new File(['a'], '1.dcm'), new File(['b'], '2.dcm')];
    const onProgress = vi.fn();

    vi.mocked(instancesApi.upload).mockResolvedValue({ ID: 'inst-1', Status: 'Success' });
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance('inst-1', 'series-1'));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries('series-1', targetStudyId));

    await addDicomToStudyAction(targetStudyId, files, onProgress);

    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('rethrows merge errors and emits a failure audit', async () => {
    const files = [new File(['a'], '1.dcm')];
    const uploadedInstanceId = 'inst-1';
    const sourceSeriesId = 'source-series';
    const sourceStudyId = 'source-study';

    vi.mocked(instancesApi.upload).mockResolvedValue({ ID: uploadedInstanceId, Status: 'Success' });
    vi.mocked(instancesApi.get).mockResolvedValue(makeInstance(uploadedInstanceId, sourceSeriesId));
    vi.mocked(seriesApi.get).mockResolvedValue(makeSeries(sourceSeriesId, sourceStudyId));
    vi.mocked(studiesApi.get).mockImplementation(async (id: string) => {
      if (id === targetStudyId) return makeStudy(targetStudyId, 'DEMO-001', 'Patient^Demo001', '19680427');
      return makeStudy(id, 'DEMO-001', 'Patient^Demo001', '19680427');
    });
    const err = new OrthancError(500, 'c', 'merge failed');
    vi.mocked(mergeStudyAction).mockRejectedValue(err);

    await expect(addDicomToStudyAction(targetStudyId, files)).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'study.addDicom',
      outcome: 'failure',
    }));
  });
});
