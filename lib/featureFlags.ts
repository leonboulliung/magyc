function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

export const FEATURE_FLAGS = {
  /** Best-effort operational events in the app_events table. */
  appEvents: envBool("MAGYC_FEATURE_APP_EVENTS", true),
  /** Browser media uses signed Supabase Storage URLs via the storage adapter. */
  directSupabaseStorage: envBool("MAGYC_FEATURE_DIRECT_SUPABASE_STORAGE", true),
  /** Store the active data-contract version on newly created spaces. */
  spaceContractVersion: envBool("MAGYC_FEATURE_SPACE_CONTRACT_VERSION", true),
  /** Show operations details in the admin backend. */
  adminOperations: envBool("MAGYC_FEATURE_ADMIN_OPERATIONS", true),
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return FEATURE_FLAGS[name];
}

export function featureFlagSnapshot(): Record<FeatureFlagName, boolean> {
  return { ...FEATURE_FLAGS };
}
