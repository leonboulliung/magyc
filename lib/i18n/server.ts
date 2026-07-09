import "server-only";
import { cookies, headers } from "next/headers";
import { getDictionary } from "./index";
import { LOCALE_COOKIE, normalizeLocale, localeFromAcceptLanguage, DEFAULT_LOCALE, type Locale } from "./locale";

/**
 * Resolve the active locale for a server render: explicit cookie choice first
 * (set by the switcher / on sign-in from the user's defaultLanguage), then the
 * browser's Accept-Language, then the default. Reading it from the cookie is
 * what keeps the server render and the client hydration in the same language.
 */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie) return normalizeLocale(fromCookie);

  const accept = (await headers()).get("accept-language");
  return localeFromAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}

/** Convenience: the resolved locale plus its dictionary, for server components. */
export async function getServerI18n() {
  const locale = await getServerLocale();
  return { locale, t: getDictionary(locale) };
}
