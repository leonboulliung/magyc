"use client";

import { useEffect } from "react";

// Sets the detected locale in a long-lived cookie so repeat visits skip
// the Accept-Language header parse and always feel consistent.
export function LocalePersister({ locale }: { locale: string }) {
  useEffect(() => {
    const maxAge = 60 * 60 * 24 * 365 * 5;
    document.cookie = `preferred_locale=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, [locale]);
  return null;
}
