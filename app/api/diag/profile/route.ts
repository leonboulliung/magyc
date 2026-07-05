import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// TEMPORARY diagnostic: exercises the exact calls the Studio dashboard and the
// save/claim path make, and surfaces any DB error. Read-only, scoped to the
// caller's own rows. Remove once the new-account failure is fixed.
export const dynamic = "force-dynamic";

function ser(e: unknown) {
  if (!e) return null;
  const x = e as { message?: string; code?: string; details?: string; hint?: string };
  return { code: x.code ?? null, message: x.message ?? null, details: x.details ?? null, hint: x.hint ?? null };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const out: Record<string, unknown> = { userId };

  const fetchRes = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  out.profileFetch = { error: ser(fetchRes.error), exists: !!fetchRes.data };

  // Studio dashboard: the RPC (primary) + the list fallback.
  const rpcRes = await admin.rpc("studio_project_summaries", { p_user_id: userId });
  out.summariesRpc = { error: ser(rpcRes.error), rows: Array.isArray(rpcRes.data) ? rpcRes.data.length : null };

  const listRes = await admin
    .from("spaces")
    .select("id, title, stage, segment, shared, archived_at, deleted_at, created_at")
    .eq("owner_id", userId);
  out.spaceList = { error: ser(listRes.error), rows: Array.isArray(listRes.data) ? listRes.data.length : null };

  // Project invitations fetch (item 8 read side) — pending for this user.
  const invRes = await admin
    .from("project_invitations")
    .select("id, space_id, status")
    .eq("status", "pending")
    .limit(1);
  out.invitations = { error: ser(invRes.error) };

  return NextResponse.json(out);
}
