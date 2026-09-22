/**
 * IHE "Invoke Image Display" (IID) — the HTTP-GET binding.
 *
 * A RIS/KIS asks an *image display* to show images: either by study UID or by
 * accession number, with an optional viewer hint (IHE RAD TF-2, transaction
 * RAD-106). OE3 speaks that dialect at `/IHEInvokeImageDisplay` and translates
 * it into the viewer's own URL, so a foreign system does not have to know
 * anything about OHIF.
 *
 * This module is deliberately pure: parsing and URL building only, no network,
 * no React. The caller resolves accession numbers and patient IDs into study
 * UIDs (that needs the PACS) and does the redirect.
 */

/** What the invoker asks for: one study list, or everything of one patient. */
export type IidRequestType = 'STUDY' | 'PATIENT';

/**
 * Why a request was rejected. Codes, not sentences — the UI translates them,
 * so a German operator reads German.
 */
export type IidError =
  | ''
  | 'missingRequestType'
  | 'unknownRequestType'
  | 'missingStudyKey'
  | 'bothStudyKeys'
  | 'missingPatientID'
  | 'badMostRecentResults';

export interface IidRequest {
  /** `STUDY` or `PATIENT` — `null` when the parameter was missing or unknown. */
  requestType: IidRequestType | null;
  /** Comma-delimited `studyUID` list (empty for a patient-based request). */
  studyUIDs: string[];
  /** Comma-delimited `accessionNumber` list (empty for a patient-based request). */
  accessionNumbers: string[];
  /** `patientID` including its assigning authority, e.g. `99998410^^^Acme`. */
  patientID: string;
  /** Optional hint which viewer family the invoker wants (e.g. `IHE_BIR`). */
  viewerType: string;
  /** Optional: `true` asks for a diagnostic-quality display. */
  diagnosticQuality: boolean | null;
  /** Optional: show only the newest N studies (patient-based requests). */
  mostRecentResults: number | null;
  /** `''` when the request is valid, otherwise the reason it is not. */
  error: IidError;
}

export interface IidRequestParams {
  requestType: IidRequestType;
  studyUIDs?: string[];
  accessionNumbers?: string[];
  patientID?: string;
  viewerType?: string;
  diagnosticQuality?: boolean;
  mostRecentResults?: number;
}

/** Splits a comma-delimited IID list, dropping empty entries. */
export function splitIidList(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBooleanFlag(value: string | null): boolean | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

/**
 * Reads an IID request out of a query string.
 *
 * The rules are the supplement's: `requestType` decides which key is required —
 * a study request carries *either* `studyUID` *or* `accessionNumber` (never
 * both), a patient request needs `patientID`.
 */
export function parseIidRequest(search: string): IidRequest {
  const params = new URLSearchParams(search);
  const rawType = (params.get('requestType') ?? '').trim().toUpperCase();
  const studyUIDs = splitIidList(params.get('studyUID'));
  const accessionNumbers = splitIidList(params.get('accessionNumber'));
  const patientID = (params.get('patientID') ?? '').trim();
  const viewerType = (params.get('viewerType') ?? '').trim();
  const diagnosticQuality = parseBooleanFlag(params.get('diagnosticQuality'));
  const rawMostRecent = (params.get('mostRecentResults') ?? '').trim();

  const request: IidRequest = {
    requestType: rawType === 'STUDY' || rawType === 'PATIENT' ? rawType : null,
    studyUIDs,
    accessionNumbers,
    patientID,
    viewerType,
    diagnosticQuality,
    mostRecentResults: rawMostRecent === '' ? null : Number(rawMostRecent),
    error: '',
  };

  if (rawType === '') request.error = 'missingRequestType';
  else if (request.requestType === null) request.error = 'unknownRequestType';
  else if (request.requestType === 'STUDY') {
    if (!studyUIDs.length && !accessionNumbers.length) request.error = 'missingStudyKey';
    else if (studyUIDs.length && accessionNumbers.length) request.error = 'bothStudyKeys';
  } else if (!patientID) request.error = 'missingPatientID';

  if (
    request.mostRecentResults !== null &&
    (!Number.isInteger(request.mostRecentResults) || request.mostRecentResults < 0)
  ) {
    request.error = 'badMostRecentResults';
  }

  return request;
}

/**
 * Builds an IID URL — the form a RIS/KIS would call.
 *
 * Only the parameters that belong to the request type are emitted, so the URL
 * stays readable in a log line and never carries both keys.
 */
export function buildIidUrl(path: string, request: IidRequestParams): string {
  const params = new URLSearchParams();
  params.set('requestType', request.requestType);

  if (request.requestType === 'STUDY') {
    if (request.studyUIDs?.length) params.set('studyUID', request.studyUIDs.join(','));
    else if (request.accessionNumbers?.length) {
      params.set('accessionNumber', request.accessionNumbers.join(','));
    }
  } else if (request.patientID) {
    params.set('patientID', request.patientID);
    if (request.mostRecentResults !== undefined) {
      params.set('mostRecentResults', String(request.mostRecentResults));
    }
  }

  if (request.viewerType) params.set('viewerType', request.viewerType);
  if (request.diagnosticQuality !== undefined) {
    params.set('diagnosticQuality', String(request.diagnosticQuality));
  }

  return `${path}?${params.toString()}`;
}

/**
 * Builds the URL of the actual viewer for a list of study UIDs.
 *
 * `viewerBase` is the configured web viewer (OHIF by default). Its own
 * parameter name is used — the IID vocabulary stays at the entry point.
 */
export function buildViewerUrl(viewerBase: string, studyInstanceUIDs: string[]): string {
  const separator = viewerBase.includes('?') ? '&' : '?';
  return `${viewerBase}${separator}StudyInstanceUIDs=${studyInstanceUIDs.join(',')}`;
}

/**
 * Keeps only the newest `count` studies (IID `mostRecentResults`).
 *
 * Sorting is the caller's business: this only slices an already ordered list,
 * so the "newest first" definition lives where the study dates are known.
 */
export function limitToMostRecent<T>(studies: T[], count: number | null): T[] {
  if (count === null || count <= 0) return studies;
  return studies.slice(0, count);
}
