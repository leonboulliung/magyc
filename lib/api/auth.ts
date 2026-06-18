import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Owner authorization for structural edits to an existing space — the
 * single source of truth for "may this request change this space?".
 *
 *   Claimed (`owner_id` set): the Clerk-signed-in user must be that
 *     owner. This covers BOTH published spaces and Creator-Suite projects
 *     (which set owner_id at creation while staying private drafts).
 *   Unclaimed draft (`owner_id` null): the body must carry the matching
 *     `anon_owner_token` (≥ 16 chars, exact match) — browser-side
 *     ownership of an anonymous homepage draft.
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
  // Claimed by a Clerk account (suite project or published) → Clerk owner.
  if (space.owner_id) {
    const { userId } = await auth();
    return !!userId && userId === space.owner_id;
  }
  // Unclaimed anonymous draft → matching browser owner token.
  const tok = typeof anonOwnerToken === "string" ? anonOwnerToken.trim() : "";
  return tok.length >= 16 && tok === space.anon_owner_token;
}

/** Standard 403 for a failed owner check — consistent across routes. */
export function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
