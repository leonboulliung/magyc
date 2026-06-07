import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { newId } from "@/lib/id";

/**
 * POST /api/spaces/[id]/publish — flip a draft space to published.
 *
 *   Body: { anonOwnerToken: string }
 *
 * Requires both:
 *   - a Clerk session (the publish moment is when the anonymous owner
 *     becomes a real account)
 *   - the matching anon_owner_token (proves browser-side ownership)
 *
 * Side effects:
 *   - profiles row is ensured for the Clerk user
 *   - spaces row gets owner_id, visibility='public', published_at=now
 *   - space_versions gets a v1 snapshot of the current modules
 *
 * Idempotent: re-calling on an already-published space is a no-op
 * (returns ok). To unpublish or change visibility we'll add separate
 * endpoints later.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { anonOwnerToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const anonToken = typeof body.anonOwnerToken === "string" ? body.anonOwnerToken.trim() : "";
  if (anonToken.length < 16) {
    return NextResponse.json({ error: "owner_token_required" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: space, error: fetchErr } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, modules, title")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Authorise: the anon token must match unless this user is already
  // the owner (re-call).
  if (space.owner_id && space.owner_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!space.owner_id && space.anon_owner_token !== anonToken) {
    return NextResponse.json({ error: "owner_token_mismatch" }, { status: 403 });
  }

  // Already published — idempotent.
  if (space.visibility) {
    return NextResponse.json({ ok: true, alreadyPublished: true });
  }

  await ensureProfile(userId);

  const nowIso = new Date().toISOString();

  // Flip visibility + bind owner.
  const { error: upErr } = await admin
    .from("spaces")
    .update({
      owner_id: userId,
      visibility: "public",
      published_at: nowIso,
    })
    .eq("id", params.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Snapshot v1.
  const { error: vErr } = await admin.from("space_versions").insert({
    id: newId(),
    space_id: params.id,
    version: 1,
    title: space.title || "",
    modules: space.modules || [],
    note: null,
  });
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
