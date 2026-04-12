import { getConfig } from "./runtime";

export type FeatureKey =
  | "upload"
  | "delete"
  | "anonymize"
  | "modify"
  | "send"
  | "download"
  | "editLabels"
  | "modalityManagement"
  | "dicomWebManagement";

export type UserProfile = { permissions: string[] } | null;
export type SmartScopes = string[] | null;

type Layers = { profile: UserProfile; scopes: SmartScopes };

const SCOPE_WRITE_FEATURES = new Set<FeatureKey>([
  "upload",
  "delete",
  "anonymize",
  "modify",
  "send",
  "editLabels",
]);

function scopeAllows(scopes: string[], key: FeatureKey): boolean {
  const needsWrite = SCOPE_WRITE_FEATURES.has(key);
  return scopes.some((s) =>
    needsWrite
      ? /ImagingStudy\.(write|\*)/.test(s)
      : /ImagingStudy\.(read|\*)/.test(s),
  );
}

export function resolveFeature(key: FeatureKey, layers: Layers): boolean {
  const cfg = getConfig();
  if (cfg.features?.[key] === false) return false;
  if (layers.profile && !layers.profile.permissions.includes(key)) return false;
  if (layers.scopes && !scopeAllows(layers.scopes, key)) return false;
  return true;
}
