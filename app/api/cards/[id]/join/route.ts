import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { isBanned } from "@/lib/server/safety";

// POST = join (public mode) or request (request mode).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  await ensureProfile(userId);
  const admin = supabaseAdmin();

  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, kind, permission, spots, archived, expires_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // You join a thing; an idea is signalled, not joined.
  if (card.kind === "idea")
    return NextResponse.json({ error: "not_a_thing" }, { status: 400 });
  if (card.owner_id === userId)
    return NextResponse.json({ error: "owner_cant_join" }, { status: 400 });
  if (card.archived || (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()))
    return NextResponse.json({ error: "expired" }, { status: 400 });

  if (card.permission === "public") {
    const { count } = await admin
      .from("joiners")
      .select("user_id", { head: true, count: "exact" })
      .eq("card_id", params.id);
    if ((count ?? 0) >= card.spots)
      return NextResponse.json({ error: "full" }, { status: 400 });
    const { error } = await admin
      .from("joiners")
      .upsert({ card_id: params.id, user_id: userId }, { onConflict: "card_id,user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "joined" });
  }

  // request mode
  const { error } = await admin
    .from("join_requests")
    .upsert(
      { card_id: params.id, user_id: userId },
      { onConflict: "card_id,user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "requested" });
}

// DELETE = leave (joiner removes themselves)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  await admin.from("joiners").delete().eq("card_id", params.id).eq("user_id", userId);
  await admin.from("join_requests").delete().eq("card_id", params.id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
