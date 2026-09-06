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

/**
 * Aliases for the legacy `enableX` config.js key form (documented in CLAUDE.md /
 * AGENTS.md and used by `public/config.prod.js` and the PP backend deployment).
 * Without this mapping, `cfg.features?.[key] === false` would never match the
 * `enableDelete` / `enableSendTo` / `enableModalityConfig` keys actually shipped
 * in production, leaving all dangerous write actions (delete/modify/anonymize/send)
 * enabled regardless of the disable flag.
 */
const FEATURE_ALIASES: Record<FeatureKey, string[]> = {
  upload: ['enableUpload'],
  delete: ['enableDelete'],
  anonymize: ['enableAnonymize'],
  modify: ['enableModify'],
  send: ['enableSendTo'],
  download: ['enableDownload'],
  editLabels: ['enableEditLabels'],
  modalityManagement: ['enableModalityConfig', 'enableModalityManagement'],
  dicomWebManagement: ['enableDicomWebConfig', 'enableDicomWebManagement'],
};

function isFeatureDisabled(cfg: ReturnType<typeof getConfig>, key: FeatureKey): boolean {
  if (cfg.features?.[key] === false) return true;
  const aliases = FEATURE_ALIASES[key];
  if (aliases) {
    for (const alias of aliases) {
      if (cfg.features?.[alias] === false) return true;
    }
  }
  return false;
}

export function resolveFeature(key: FeatureKey, layers: Layers): boolean {
  const cfg = getConfig();
  if (isFeatureDisabled(cfg, key)) return false;
  if (layers.profile && !layers.profile.permissions.includes(key)) return false;
  if (layers.scopes && !scopeAllows(layers.scopes, key)) return false;
  return true;
}

export function useUserProfile(): UserProfile {
  return null; // Phase 2: fetch from Authorization plugin
}

export function useSmartScopes(): SmartScopes {
  return null; // Phase 2: parse from fhirclient token
}

export function useFeature(key: FeatureKey): boolean {
  const profile = useUserProfile();
  const scopes = useSmartScopes();
  return resolveFeature(key, { profile, scopes });
}
