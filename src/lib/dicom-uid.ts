/**
 * Fresh DICOM UID generation for Orthanc write operations.
 *
 * Root "2.25" (UUID-derived UIDs, DICOM PS 3.5 B.2): a 128-bit random value
 * rendered as a decimal integer — globally unique without a registered
 * organisation root. The result is ~44 characters, well below the 64-char limit.
 *
 * Used when Orthanc must be handed a new SeriesInstanceUID, e.g. when splitting
 * instances out of a series into a brand-new one via /tools/bulk-modify.
 */
import { newCorrelationId } from '@/lib/correlation';

/** Returns a new DICOM UID under the 2.25 root, e.g. "2.25.307691…". */
export function generateDicomUid(): string {
  const hex = newCorrelationId().replace(/-/g, '');
  return `2.25.${BigInt(`0x${hex}`).toString(10)}`;
}
