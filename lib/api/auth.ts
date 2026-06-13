import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Owner authorization for structural edits to an existing space — the
 * single source of truth for "may this request change this space?".
 *
 *   Draft (visibility === null): the body must carry the matching
 *     `anon_owner_token` (≥ 16 chars, exact match) — this proves
 *     browser-side ownership of an unclaimed draft.
 *   Published: the Clerk-signed-in user must be the bound `owner_id`.
 *
 * Collaborative interaction (votes, messages, uploads) is NOT gated by
 * this — those flow through /state and /upload with contributor auth.
 * The publish endpoint keeps its own bespoke check (it is the moment an
 * anonymous owner becomes a Clerk account, so it needs both at once).
 */
export interface OwnableSpace {
  anon_owner_token: string;
  owner_id: string | null;
  visibility: string | null;
}

export async function isSpaceOwner(
  space: OwnableSpace,
  anonOwnerToken: unknown,
): Promise<boolean> {
  if (space.visibility === null) {
    const tok = typeof anonOwnerToken === "string" ? anonOwnerToken.trim() : "";
    return tok.length >= 16 && tok === space.anon_owner_token;
  }
  const { userId } = await auth();
  return !!userId && !!space.owner_id && userId === space.owner_id;
}

/** Standard 403 for a failed owner check — consistent across routes. */
export function forbidden(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 403 });
}
