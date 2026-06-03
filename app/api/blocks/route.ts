import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/** GET — list users the current user has blocked (just the IDs, for UI). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ blocked: [] });

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  const blocked = (data || []).map((r) => r.blocked_id as string);
  return NextResponse.json({ blocked });
}

/**
 * POST — block another profile. One-directional: blocker stops seeing
 * blocked user's cards in their feed. The admin queue handles anything
 * heavier.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const targetId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetId) return NextResponse.json({ error: "bad_user_id" }, { status: 400 });
  if (targetId === userId)
    return NextResponse.json({ error: "self_block" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  if (!prof) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await admin
    .from("blocks")
    .upsert(
      { blocker_id: userId, blocked_id: targetId },
      { onConflict: "blocker_id,blocked_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
