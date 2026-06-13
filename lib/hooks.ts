"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getSpaceOwnerToken } from "./anonId";
import type { Space } from "./types";

/**
 * Whether the current viewer has owner privileges on this space.
 *
 *   Draft (visibility === null):
 *     true if the browser holds the matching anon_owner_token in
 *     localStorage. The DB-side `anonOwnerTokenHint` only tells us
 *     a token exists; matching happens at the API.
 *
 *   Published:
 *     true if the Clerk-signed-in user is the bound owner_id.
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

  if (space.visibility === null) {
    // Draft: presence of the owner token is the signal.
    return hasOwnerToken;
  }

  // Published: Clerk owner.
  return !!user && !!space.owner && space.owner.id === user.id;
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
