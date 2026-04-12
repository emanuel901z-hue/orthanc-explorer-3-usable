export type RawDicomTag = { Name?: string; Type?: string; Value?: string | null };

/**
 * Maps raw Orthanc DICOM tag objects to a display-ready shape.
 * Used by shared-tags hooks across studies and series.
 */
export function mapDicomTagEntries(raw: Record<string, RawDicomTag>) {
  return Object.entries(raw).map(([tag, v]) => ({
    tag,
    name: v.Name ?? tag,
    vr: v.Type ?? '',
    value: v.Value == null ? '' : typeof v.Value === 'string' ? v.Value : JSON.stringify(v.Value),
  }));
}
