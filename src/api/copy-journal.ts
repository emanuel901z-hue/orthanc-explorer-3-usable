/**
 * Kopier-Journal — was der Orthanc-Job nicht hergibt.
 *
 * Orthanc reduziert den C-MOVE-Identifier auf die Haupt-Tags (Zugangsnummer,
 * Patienten-ID, StudyInstanceUID); Patientname und Geburtsdatum stehen nicht im
 * Job. Die Oberfläche schickt sie beim Kopieren an den Ziele-Dienst, damit
 * „Kopieraufträge“ die Studie lesen und durchsuchen kann.
 */
import { JSON_CONTENT_HEADERS } from '@/lib/client';
import { targetsFetch } from '@/api/targets';

export type CopyJournalEntry = {
  /** Orthanc-Job-ID des C-MOVE. */
  jobId: string;
  patientName?: string;
  patientId?: string;
  /** DICOM-Datum (YYYYMMDD). */
  birthDate?: string;
  studyInstanceUid?: string;
  studyDescription?: string;
  accessionNumber?: string;
  studyDate?: string;
  sourceAet?: string;
  targetAet?: string;
  /** Zeitpunkt der Mitschrift (ISO 8601). */
  recordedAt?: string;
};

type Payload = { entries: CopyJournalEntry[] };

export const copyJournalApi = {
  list: () => targetsFetch<Payload>('/copy-journal').then((payload) => payload?.entries ?? []),
  record: (entry: CopyJournalEntry) =>
    targetsFetch<{ entry: CopyJournalEntry }>('/copy-journal', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify(entry),
    }).then((payload) => payload?.entry),
  /** Räumt den Eintrag zu einem gelöschten Auftrag ab. */
  remove: (jobId: string) =>
    targetsFetch<{ removed: boolean }>(`/copy-journal/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }).then((payload) => payload?.removed ?? false),
};
