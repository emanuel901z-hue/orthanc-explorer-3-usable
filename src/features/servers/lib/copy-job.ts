/**
 * Kopieraufträge lesen: Orthanc führt jeden asynchronen C-MOVE als Job vom Typ
 * `DicomMoveScu`. Aus dem Job wird, was die Oberfläche anzeigen muss — Zustand,
 * DIMSE-Status der Gegenstelle, Quelle, Ziel, Studie und Laufzeit.
 */
import type { OrthancJob } from '@/api/jobs';
import { DIMSE_SUCCESS, extractDimseStatus, formatDimseStatus } from './dimse-status';

export type CopyJobState = 'running' | 'success' | 'failed';

export type CopyJobView = {
  jobId: string;
  state: CopyJobState;
  /** Zustand wie Orthanc ihn nennt (Pending, Running, Success, Failure …). */
  rawState: OrthancJob['State'];
  progress: number;
  sourceAet?: string;
  targetAet?: string;
  studyInstanceUid?: string;
  patientId?: string;
  /** DIMSE-Status der Gegenstelle, z. B. "0x0000". */
  dimseStatus?: string;
  /** Nur bei Fehlschlag: Klartext aus dem Job. */
  error?: string;
  creationTime?: string;
  completionTime?: string;
  durationSeconds?: number;
};

const MOVE_JOB_TYPE = 'DicomMoveScu';

export function isMoveJob(job: OrthancJob): boolean {
  return job.Type === MOVE_JOB_TYPE;
}

function contentString(content: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = content?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function firstQuery(content: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const query = content?.Query;
  if (!Array.isArray(query) || query.length === 0) return undefined;
  const first = query[0];
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
}

/** DICOM-Tags kommen je nach Orthanc-Aufruf symbolisch oder als Hex-Tag. */
function queryTag(query: Record<string, unknown> | undefined, symbolic: string, hex: string): string | undefined {
  const value = query?.[symbolic] ?? query?.[hex];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function describeCopyJob(job: OrthancJob): CopyJobView {
  const content = job.Content;
  const query = firstQuery(content);
  const dimse = extractDimseStatus(content);
  const failed = job.State === 'Failure';

  return {
    jobId: job.ID,
    state: job.State === 'Success' ? 'success' : failed ? 'failed' : 'running',
    rawState: job.State,
    progress: typeof job.Progress === 'number' ? job.Progress : 0,
    sourceAet: contentString(content, 'RemoteAet'),
    targetAet: contentString(content, 'TargetAet'),
    studyInstanceUid: queryTag(query, 'StudyInstanceUID', '0020,000d'),
    patientId: queryTag(query, 'PatientID', '0010,0020'),
    dimseStatus: dimse === undefined ? undefined : formatDimseStatus(dimse),
    error: failed
      ? job.ErrorDescription && job.ErrorDescription !== 'Success'
        ? job.ErrorDescription
        : job.ErrorDetails || undefined
      : undefined,
    creationTime: job.CreationTime,
    completionTime: job.CompletionTime,
    durationSeconds: typeof job.EffectiveRuntime === 'number' ? job.EffectiveRuntime : undefined,
  };
}

/** Erfolg nur, wenn der Job durch ist und die Gegenstelle 0x0000 gemeldet hat. */
export function isCopyConfirmed(view: CopyJobView): boolean {
  return view.state === 'success' && view.dimseStatus === formatDimseStatus(DIMSE_SUCCESS);
}
