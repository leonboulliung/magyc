"use client";

import { useLocale } from "./LocaleProvider";
import { LOCALES, type Locale } from "@/lib/i18n/locale";

/**
 * Minimal DE / EN toggle. Sets the locale cookie and refreshes so the whole
 * app (server + client) re-renders in the chosen language.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className={`mono inline-flex items-center gap-1 text-[11px] ${className}`} aria-label={t.language.label}>
      {LOCALES.map((code, i) => (
        <span key={code} className="inline-flex items-center">
          {i > 0 && <span className="opacity-30 px-1">/</span>}
          <button
            type="button"
            onClick={() => setLocale(code as Locale)}
            aria-pressed={locale === code}
            className={`uppercase tracking-widest transition-opacity ${locale === code ? "opacity-100 font-semibold" : "opacity-45 hover:opacity-80"}`}
          >
            {code}
          </button>
        </span>
      ))}
    </div>
  );
}
