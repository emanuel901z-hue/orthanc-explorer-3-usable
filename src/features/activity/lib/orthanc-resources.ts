/**
 * Orthanc job `Content.Resources` / `Content.ParentResources` entries are
 * resource references. Depending on the Orthanc version and job type an entry
 * is either a bare resource ID (string) or an object `{ ID, Type }` — the
 * modify/anonymize jobs of the TEMP-PACS return the object form.
 *
 * Rendering such an object directly as a React child throws React error #31
 * ("Objects are not valid as a React child"). Always normalize first.
 */

export interface OrthancResourceRef {
  ID?: string;
  Type?: string;
}

/** Resource ID of a reference — accepts the string and the `{ ID, Type }` form. */
export function resourceRefId(ref: unknown): string | undefined {
  if (typeof ref === 'string') return ref.length > 0 ? ref : undefined;
  if (ref && typeof ref === 'object') {
    const id = (ref as OrthancResourceRef).ID;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  }
  return undefined;
}

/** Resource type of a reference, when Orthanc provides one. */
export function resourceRefType(ref: unknown): string | undefined {
  if (ref && typeof ref === 'object') {
    const type = (ref as OrthancResourceRef).Type;
    return typeof type === 'string' && type.length > 0 ? type : undefined;
  }
  return undefined;
}

/** Normalizes a job resource list into plain ID strings (objects → their ID). */
export function normalizeResourceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((ref) => resourceRefId(ref))
    .filter((id): id is string => id !== undefined);
}
