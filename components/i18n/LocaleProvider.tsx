"use client";

import { createContext, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";

interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provides the active locale + its dictionary to the client tree. The `locale`
 * is resolved on the server (from the cookie) and passed in, so the first
 * client render matches the server HTML — no hydration mismatch.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Re-render server components (and this provider's `locale` prop) in the
    // new language without losing client state.
    router.refresh();
  }, [router]);

  const value: LocaleContextValue = { locale, t: getDictionary(locale), setLocale };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Defensive fallback so a stray client component never crashes; German.
    return { locale: "de", t: getDictionary("de"), setLocale: () => {} };
  }
  return ctx;
}

/** The typed dictionary for the active locale. `const t = useT(); t.common.save` */
export function useT(): Dictionary {
  return useLocale().t;
}
