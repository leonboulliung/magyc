"use client";

import { useEffect, useState } from "react";

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Use it to gate output that legitimately differs between server and client —
 * chiefly locale/timezone-dependent date formatting. Render a server-stable
 * value while `false` (so the first client render matches the server HTML and
 * React doesn't throw a hydration mismatch, #418), then the real local value
 * once `true`.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}
