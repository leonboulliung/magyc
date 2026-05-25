"use client";

import { useEffect, useState } from "react";

/**
 * Match a CSS media query reactively. Returns false on the server and on
 * first client render, then updates on mount once we can read window.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** True when the viewport is wide enough for a side-panel composer. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 900px)");
}
