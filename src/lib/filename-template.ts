/**
 * filename-template — Build download filenames from DICOM study metadata.
 *
 * Supports template tokens inspired by OE2's DownloadStudyFileNameTemplate:
 *   {patientName}   — Patient name (spaces instead of ^)
 *   {patientId}     — Patient ID
 *   {studyDate}     — Study date (YYYYMMDD)
 *   {studyTime}     — Study time (HHMMSS)
 *   {accession}     — Accession number
 *   {modality}      — First modality
 *   {studyDescription} — Study description (sanitized)
 *   {uid}           — Study Instance UID
 *   {date}          — Current date (YYYYMMDD)
 *   {time}          — Current time (HHMMSS)
 *
 * Default template: "{patientName}_{studyDate}_{accession}"
 */

export interface FilenameContext {
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  studyTime?: string;
  accessionNumber?: string;
  modalities?: string[];
  studyDescription?: string;
  studyInstanceUID?: string;
}

/** Sanitize a string for use in a filename (remove path separators and special chars). */
function sanitize(value: string): string {
  return value
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80); // limit length
}

/** Build a filename from a template string and a context object. */
export function buildFilename(template: string, ctx: FilenameContext): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeNow = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const replacements: Record<string, string> = {
    patientName: sanitize(ctx.patientName || ''),
    patientId: sanitize(ctx.patientId || ''),
    studyDate: sanitize(ctx.studyDate || ''),
    studyTime: sanitize(ctx.studyTime || ''),
    accession: sanitize(ctx.accessionNumber || ''),
    modality: sanitize(ctx.modalities?.[0] || ''),
    studyDescription: sanitize(ctx.studyDescription || ''),
    uid: sanitize(ctx.studyInstanceUID || ''),
    date: today,
    time: timeNow,
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${token}\\}`, 'gi'), value);
  }

  // Remove empty tokens that left underscores
  result = result.replace(/_{2,}/g, '_').replace(/^_|_$/g, '');

  return result || 'download';
}

/** Default filename template. */
export const DEFAULT_FILENAME_TEMPLATE = '{patientName}_{studyDate}_{accession}';
