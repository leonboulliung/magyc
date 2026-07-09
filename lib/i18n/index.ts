import { de, type Dictionary } from "./dictionaries/de";
import { en } from "./dictionaries/en";
import type { Locale } from "./locale";

const DICTIONARIES: Record<Locale, Dictionary> = { de, en };

/** The typed string dictionary for a locale. Safe on server and client. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? de;
}

export type { Dictionary } from "./dictionaries/de";
export * from "./locale";
