"use client";

import { useEffect, useState } from "react";

/**
 * Dev mode — gates developer-only affordances (the persona switcher for
 * simulating multiplayer) so real users never see them in production,
 * while keeping them one query param away for testing on live spaces.
 *
 * Enable:  append ?dev=1 to any URL  →  persists in localStorage
 * Disable: append ?dev=0
 *
 * The /dev showroom turns it on regardless.
 */
const KEY = "magyc.dev";

export function useDevMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("dev");
      if (q === "1") window.localStorage.setItem(KEY, "1");
      else if (q === "0") window.localStorage.removeItem(KEY);
      setOn(window.localStorage.getItem(KEY) === "1");
    } catch {
      setOn(false);
    }
  }, []);
  return on;
}
