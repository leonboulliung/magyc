/**
 * Account-level Studio profile + settings. Persisted on the `profiles` row
 * (see migration 014). The profile is the photographer's public-facing
 * identity; settings are private account preferences, including the global
 * "rules" that get woven into every new project's brief.
 */

export interface StudioSettings {
  /** Working-style rules applied to every new project (prompt injections). */
  rules: string[];
  /** Default language for new projects. */
  defaultLanguage: string;
  /** New projects start shared (link-accessible) instead of private. */
  defaultShared: boolean;
}

export interface StudioProfile {
  displayName: string;
  headline: string;
  bio: string;
  specialties: string[];
  settings: StudioSettings;
  /** Read-only, snapshotted from Clerk. */
  avatarUrl: string | null;
  color: string | null;
}

export const LANGUAGE_OPTIONS = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "nl", label: "Nederlands" },
  { value: "pt", label: "Português" },
] as const;

export const DEFAULT_SETTINGS: StudioSettings = {
  rules: [],
  defaultLanguage: "de",
  defaultShared: false,
};

function asStringArray(value: unknown, max = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function cleanSettings(raw: unknown): StudioSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lang = typeof o.defaultLanguage === "string" ? o.defaultLanguage : DEFAULT_SETTINGS.defaultLanguage;
  return {
    rules: asStringArray(o.rules, 12),
    defaultLanguage: LANGUAGE_OPTIONS.some((l) => l.value === lang) ? lang : DEFAULT_SETTINGS.defaultLanguage,
    defaultShared: o.defaultShared === true,
  };
}

export function cleanProfile(raw: unknown): StudioProfile {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    displayName: typeof o.displayName === "string" ? o.displayName.slice(0, 80) : "",
    headline: typeof o.headline === "string" ? o.headline.slice(0, 120) : "",
    bio: typeof o.bio === "string" ? o.bio.slice(0, 600) : "",
    specialties: asStringArray(o.specialties),
    settings: cleanSettings(o.settings),
    avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : null,
    color: typeof o.color === "string" ? o.color : null,
  };
}
