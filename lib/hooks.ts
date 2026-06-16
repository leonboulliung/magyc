"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getSpaceOwnerToken } from "./anonId";
import type { Space } from "./types";

/**
 * Whether the current viewer has owner privileges on this space.
 *
 *   Claimed (`owner` set — Creator-Suite project or published space):
 *     true if the Clerk-signed-in user is that owner.
 *
 *   Unclaimed anonymous draft (`owner` null):
 *     true if the browser holds the matching anon_owner_token in
 *     localStorage. The DB-side `anonOwnerTokenHint` only tells us
 *     a token exists; matching happens at the API.
 *
 * The hook runs only client-side and returns false during SSR.
 */
export function useIsOwner(space: Space | null): boolean {
  const { user } = useUser();
  const [hasOwnerToken, setHasOwnerToken] = useState(false);

  useEffect(() => {
    if (!space) {
      setHasOwnerToken(false);
      return;
    }
    setHasOwnerToken(!!getSpaceOwnerToken(space.id));
  }, [space]);

  if (!space) return false;

  // Claimed by a Clerk account (suite project or published).
  if (space.owner) {
    return !!user && space.owner.id === user.id;
  }

  // Unclaimed anonymous draft: presence of the browser owner token.
  return hasOwnerToken;
}

/**
 * True when the viewport is at or below the given breakpoint (defaults
 * to Tailwind's `sm`, 640px) — i.e. phone width. SSR-safe: returns false
 * on the server and first paint, then syncs after mount. Use to switch
 * desktop popovers for mobile bottom sheets.
 */
export function useIsMobile(query = "(max-width: 640px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return isMobile;
}
