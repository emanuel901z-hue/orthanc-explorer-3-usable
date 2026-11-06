/**
 * Eine Studie, wie sie aus einer C-FIND-Antwort des entfernten Archivs kommt.
 *
 * Das Archiv liefert nur die Tags, die angefragt wurden — die Anzeigefelder
 * stehen deshalb alle in `REMOTE_RETURN_KEYS` (siehe `remote-query.ts`).
 */
export type RemoteStudy = {
  queryId: string;
  answerIndex: number;
  patientName: string;
  patientId: string;
  birthDate: string;
  studyDate: string;
  studyDescription: string;
  accessionNumber: string;
  modalities: string;
  studyInstanceUid: string;
  retrieving: boolean;
  retrieved: boolean;
  error: boolean;
  /** C-MOVE an ein Zielarchiv läuft als Job; dessen ID steht hier. */
  copying: boolean;
  copyJobId?: string;
};

/** DICOM-Tags kommen je nach Aufruf symbolisch oder als Hex-Tag. */
function tag(tags: Record<string, string>, symbolic: string, hex: string, fallback = '—'): string {
  return tags[symbolic] || tags[hex] || fallback;
}

export function mapRemoteAnswer(
  queryId: string,
  answerIndex: number,
  tags: Record<string, string>,
): RemoteStudy {
  return {
    queryId,
    answerIndex,
    patientName: tag(tags, 'PatientName', '0010,0010'),
    patientId: tag(tags, 'PatientID', '0010,0020'),
    birthDate: tags['PatientBirthDate'] || tags['0010,0030'] || '',
    studyDate: tag(tags, 'StudyDate', '0008,0020'),
    studyDescription: tag(tags, 'StudyDescription', '0008,1030'),
    accessionNumber: tag(tags, 'AccessionNumber', '0008,0050'),
    modalities: tag(tags, 'ModalitiesInStudy', '0008,0061'),
    studyInstanceUid: tags['StudyInstanceUID'] || tags['0020,000d'] || '',
    retrieving: false,
    retrieved: false,
    error: false,
    copying: false,
  };
}

/** Sortierbare Spalten der Trefferliste. */
export type RemoteSortKey =
  | 'patientName'
  | 'patientId'
  | 'studyDate'
  | 'studyDescription'
  | 'accessionNumber';

export type RemoteSort = { id: RemoteSortKey; desc: boolean };

/** Sortiert eine Kopie der Liste; Datum und UID sortieren als Zeichenkette richtig. */
export function sortRemoteStudies(studies: RemoteStudy[], sort: RemoteSort): RemoteStudy[] {
  return [...studies].sort((a, b) => {
    const left = a[sort.id] ?? '';
    const right = b[sort.id] ?? '';
    const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    return sort.desc ? -result : result;
  });
}
