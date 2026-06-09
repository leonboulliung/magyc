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
