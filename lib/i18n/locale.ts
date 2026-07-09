/**
 * Lightweight i18n core. No routing changes and no heavy dependency: the
 * active locale lives in a cookie (so server and client agree on the first
 * render — critical to avoid hydration mismatches, cf. React #418), and the
 * UI reads typed dictionaries. German stays the default; English is additive.
 */

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Cookie the locale is persisted in (readable server- and client-side). */
export const LOCALE_COOKIE = "magyc_locale";

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

/** Coerce any input (cookie, header, user setting) to a supported locale. */
export function normalizeLocale(x: unknown): Locale {
  if (isLocale(x)) return x;
  if (typeof x === "string") {
    const base = x.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Pick the best supported locale from an Accept-Language header value. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim();
    const base = tag?.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return null;
}
