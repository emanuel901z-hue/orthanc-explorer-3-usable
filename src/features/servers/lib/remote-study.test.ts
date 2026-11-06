import { describe, it, expect } from 'vitest';
import { mapRemoteAnswer, sortRemoteStudies, type RemoteStudy } from './remote-study';

const TAGS = {
  PatientName: 'MUSTER^ERIKA',
  PatientID: 'P-100',
  PatientBirthDate: '19920502',
  StudyDate: '20260603',
  StudyDescription: 'CT Thorax',
  AccessionNumber: 'ACC-1',
  ModalitiesInStudy: 'CT',
  StudyInstanceUID: '1.2.3',
};

function study(overrides: Partial<RemoteStudy> = {}): RemoteStudy {
  return { ...mapRemoteAnswer('q-1', 0, TAGS), ...overrides };
}

describe('mapRemoteAnswer', () => {
  it('liest symbolische Tags', () => {
    expect(mapRemoteAnswer('q-1', 0, TAGS)).toMatchObject({
      queryId: 'q-1',
      answerIndex: 0,
      patientName: 'MUSTER^ERIKA',
      patientId: 'P-100',
      birthDate: '19920502',
      studyDate: '20260603',
      studyDescription: 'CT Thorax',
      accessionNumber: 'ACC-1',
      modalities: 'CT',
      studyInstanceUid: '1.2.3',
      retrieving: false,
      copying: false,
    });
  });

  it('versteht auch die Hex-Schreibweise der Tags', () => {
    const view = mapRemoteAnswer('q-1', 3, {
      '0010,0010': 'MUSTER^ERIKA',
      '0010,0020': 'P-100',
      '0008,0020': '20260603',
      '0008,1030': 'CT Thorax',
      '0008,0050': 'ACC-1',
      '0008,0061': 'CT',
      '0020,000d': '1.2.3',
    });

    expect(view).toMatchObject({
      patientName: 'MUSTER^ERIKA',
      patientId: 'P-100',
      studyDate: '20260603',
      studyDescription: 'CT Thorax',
      accessionNumber: 'ACC-1',
      modalities: 'CT',
      studyInstanceUid: '1.2.3',
      answerIndex: 3,
    });
  });

  it('füllt fehlende Felder mit einem Strich, das Geburtsdatum bleibt leer', () => {
    const view = mapRemoteAnswer('q-1', 0, {});
    expect(view.patientName).toBe('—');
    expect(view.birthDate).toBe('');
    expect(view.studyInstanceUid).toBe('');
  });
});

describe('sortRemoteStudies', () => {
  const studies = [
    study({ answerIndex: 0, patientName: 'ZANDER^ANNA', studyDate: '20260101' }),
    study({ answerIndex: 1, patientName: 'ALBERT^BERT', studyDate: '20260603' }),
    study({ answerIndex: 2, patientName: 'MUSTER^ERIKA', studyDate: '20251231' }),
  ];

  it('sortiert nach Name aufsteigend', () => {
    const sorted = sortRemoteStudies(studies, { id: 'patientName', desc: false });
    expect(sorted.map((s) => s.patientName)).toEqual(['ALBERT^BERT', 'MUSTER^ERIKA', 'ZANDER^ANNA']);
  });

  it('sortiert nach Datum absteigend (DICOM-Datum sortiert als Zeichenkette)', () => {
    const sorted = sortRemoteStudies(studies, { id: 'studyDate', desc: true });
    expect(sorted.map((s) => s.studyDate)).toEqual(['20260603', '20260101', '20251231']);
  });

  it('lässt die Originalliste unverändert', () => {
    const before = studies.map((s) => s.answerIndex);
    sortRemoteStudies(studies, { id: 'patientName', desc: false });
    expect(studies.map((s) => s.answerIndex)).toEqual(before);
  });

  it('sortiert Zahlen natürlich (2 vor 10)', () => {
    const withNumbers = [
      study({ answerIndex: 0, patientId: 'P-10' }),
      study({ answerIndex: 1, patientId: 'P-2' }),
    ];
    const sorted = sortRemoteStudies(withNumbers, { id: 'patientId', desc: false });
    expect(sorted.map((s) => s.patientId)).toEqual(['P-2', 'P-10']);
  });

  it('kommt mit fehlenden Werten zurecht', () => {
    const withGaps = [
      study({ answerIndex: 0, accessionNumber: '—' }),
      study({ answerIndex: 1, accessionNumber: 'ACC-1' }),
    ];
    expect(() => sortRemoteStudies(withGaps, { id: 'accessionNumber', desc: false })).not.toThrow();
  });
});
