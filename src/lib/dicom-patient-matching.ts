/**
 * DICOM patient-identity comparison — client-side, no backend.
 *
 * Ported and simplified from PP-Portal PatientIdNormalizationService.
 * Operates purely on DICOM tags available in Orthanc (`PatientID`,
 * `PatientName`, `PatientBirthDate`).
 *
 * Matching strategy (conservative):
 *   1. If both `PatientID` are present and equal → same patient.
 *   2. Otherwise: compare `PatientName` (DICOM PN, Umlaut-safe) +
 *      `PatientBirthDate`.
 *
 * Why conservative: We are deciding whether to MERGE two Orthanc studies.
 * A false negative (same patient, not merged) is annoying but safe.
 * A false positive (different patient, merged) is a patient-safety incident.
 *
 * Limitations vs. backend:
 *   - No DB, no AccessionNumber/SIUID resolution.
 *   - Cannot detect multiple demographic matches (name collisions).
 *   - No encryption handling (OE3 sees decrypted Orthanc tags only).
 */

export type PatientSignature = {
  patientId: string;
  patientName: string;
  patientBirthDate: string;
};

/**
 * Parses DICOM Person Name (PN) format: LastName^FirstName^Middle^Prefix^Suffix.
 * Returns only lastName and firstName, trimmed.
 */
export function parseDicomName(name: string): { lastName: string; firstName: string } {
  const parts = (name ?? '').split('^');
  return {
    lastName: (parts[0] ?? '').trim(),
    firstName: (parts[1] ?? '').trim(),
  };
}

/**
 * Generates Umlaut-safe name variants:
 *   - Original (lowercased)
 *   - Umlaute aufgelöst (ü → ue, ö → oe, ä → ae, ß → ss)
 *   - Umlaute zurückgewandelt (ue → ü, oe → ö, ae → ä, ss → ß)
 *
 * Same logic as backend PatientIdNormalizationService.generateNameVariants().
 */
export function generateNameVariants(name: string): string[] {
  if (!name) return [];

  const variants = new Set<string>();
  const lower = name.toLowerCase().trim();
  variants.add(lower);

  const resolved = lower
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss');
  variants.add(resolved);

  const umlautified = lower
    .replace(/ae/g, '\u00e4')
    .replace(/oe/g, '\u00f6')
    .replace(/ue/g, '\u00fc')
    .replace(/ss/g, '\u00df');
  variants.add(umlautified);

  return Array.from(variants);
}

/**
 * Normalizes a DICOM date string (YYYYMMDD) to ISO (YYYY-MM-DD).
 * Accepts an already-ISO string as-is.
 * Returns null if the format is not usable.
 */
export function normalizeDicomDate(date: string): string | null {
  if (!date) return null;

  const isoMatch = date.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) return date;

  const dicomMatch = date.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dicomMatch) {
    return `${dicomMatch[1]}-${dicomMatch[2]}-${dicomMatch[3]}`;
  }

  return null;
}

function setsIntersect(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.some((v) => setB.has(v));
}

/**
 * Compares two first names with prefix tolerance:
 *   "Hans-P" matches "Hans-Peter"
 *   "Hans" matches "Hans"
 *
 * Same rule as backend PatientIdNormalizationService.resolveByDemographics().
 */
function firstNameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  const variantsA = generateNameVariants(a);
  const variantsB = generateNameVariants(b);
  return variantsA.some((va) =>
    variantsB.some((vb) => va === vb || va.startsWith(vb) || vb.startsWith(va)),
  );
}

function lastNameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  return setsIntersect(generateNameVariants(a), generateNameVariants(b));
}

/**
 * Extracts a PatientSignature from Orthanc PatientMainDicomTags.
 */
export function getPatientSignature(tags: Record<string, string | null>): PatientSignature {
  return {
    patientId: tags.PatientID ?? '',
    patientName: tags.PatientName ?? '',
    patientBirthDate: tags.PatientBirthDate ?? '',
  };
}

/**
 * Returns true if two patient signatures represent the same patient.
 *
 * Strategy:
 *   1. PatientID match (exact) when both present.
 *   2. Demography match (Umlaut-safe name + DOB) when IDs are absent/empty.
 *   3. Birth date is required for demography matching.
 */
export function patientSignaturesMatch(a: PatientSignature, b: PatientSignature): boolean {
  // Authoritative: PatientID exact match when present on both sides.
  if (a.patientId && b.patientId) {
    return a.patientId === b.patientId;
  }

  // Fallback: name + birth date.
  if (!a.patientBirthDate || !b.patientBirthDate) return false;

  const dobA = normalizeDicomDate(a.patientBirthDate);
  const dobB = normalizeDicomDate(b.patientBirthDate);
  if (!dobA || !dobB || dobA !== dobB) return false;

  const nameA = parseDicomName(a.patientName);
  const nameB = parseDicomName(b.patientName);

  if (!lastNameMatches(nameA.lastName, nameB.lastName)) return false;

  // If at least one side has a first name, require a match (exact or prefix).
  // If both sides are last-name-only, we accept last-name + DOB.
  const hasFirstA = !!nameA.firstName;
  const hasFirstB = !!nameB.firstName;
  if (hasFirstA || hasFirstB) {
    if (hasFirstA && hasFirstB) {
      return firstNameMatches(nameA.firstName, nameB.firstName);
    }
    // One side has first name, the other does not — too ambiguous without DB.
    return false;
  }

  return true;
}
