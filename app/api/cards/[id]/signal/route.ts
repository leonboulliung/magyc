import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { isBanned } from "@/lib/server/safety";

// POST = signal resonance on an idea ("I'd want this to exist / I'd help").
// A signal is INTENT, not a vanity like. One per (card, user). Idempotent.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  await ensureProfile(userId);
  const admin = supabaseAdmin();

  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, kind, archived")
    .eq("id", params.id)
    .maybeSingle();
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Signals are an idea-only mechanic. A thing is joined, not signalled.
  if (card.kind !== "idea")
    return NextResponse.json({ error: "not_an_idea" }, { status: 400 });
  if (card.archived)
    return NextResponse.json({ error: "archived" }, { status: 400 });

  const { error } = await admin
    .from("signals")
    .upsert({ card_id: params.id, user_id: userId }, { onConflict: "card_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "signalled" });
}

// DELETE = withdraw a resonance signal.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  await admin.from("signals").delete().eq("card_id", params.id).eq("user_id", userId);
  return NextResponse.json({ ok: true, status: "withdrawn" });
}
