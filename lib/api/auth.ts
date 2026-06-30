import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProjectAccess, canEditProject } from "@/lib/server/projectAccess";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Structural-edit authorization for an existing space — the single source of
 * truth for "may this request change this space?".
 *
 *   Claimed (`owner_id` set): the Clerk-signed-in user must be the owner or a
 *     project member with the editor role.
 *   Unclaimed draft (`owner_id` null): the body must carry the matching
 *     `anon_owner_token` (≥ 16 chars, exact match) — browser-side
 *     ownership of an anonymous homepage draft.
 *
 * Collaborative interaction (votes, approvals, uploads) is NOT gated by
 * this — those flow through /state and /upload with contributor auth.
 * The publish endpoint keeps its own bespoke check (it is the moment an
 * anonymous owner becomes a Clerk account, so it needs both at once).
 */
export interface OwnableSpace {
  id: string;
  anon_owner_token: string;
  owner_id: string | null;
  visibility: string | null;
}

export async function isSpaceOwner(
  space: OwnableSpace,
  anonOwnerToken: unknown,
): Promise<boolean> {
  // Claimed by a Clerk account → owner or an explicitly assigned editor.
  if (space.owner_id) {
    const { userId } = await auth();
    if (!userId) return false;
    const role = await getProjectAccess(supabaseAdmin(), {
      spaceId: space.id,
      ownerId: space.owner_id,
      userId,
    });
    return canEditProject(role);
  }
  // Unclaimed anonymous draft → matching browser owner token.
  const tok = typeof anonOwnerToken === "string" ? anonOwnerToken.trim() : "";
  return tok.length >= 16 && tok === space.anon_owner_token;
}

/** Standard 403 for a failed structural-edit check. */
export function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
