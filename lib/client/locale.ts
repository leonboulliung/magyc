"use client";

import { getDictionary } from "@/lib/i18n";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n/locale";

export function activeClientLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.slice(LOCALE_COOKIE.length + 1)) : "";
  return normalizeLocale(value);
}

export function activeClientDictionary() {
  return getDictionary(activeClientLocale());
}
