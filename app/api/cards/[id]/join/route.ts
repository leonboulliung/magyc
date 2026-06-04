import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { isBanned } from "@/lib/server/safety";

// POST = join (public mode) or request (request mode).
//
// Body (optional): { role?: string } — when set, the joiner claims that
// predefined role on the card ("Ich mach's"). The label must match an
// entry in `cards.roles` (case-insensitive) and not already be taken by
// another joiner. An empty / missing role means "just dabei".
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  await ensureProfile(userId);
  const admin = supabaseAdmin();

  // Pull the role label (if any) off the body. Tolerant on parse —
  // missing body just means a plain join.
  let claimedRole = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { role?: unknown };
    if (typeof body.role === "string") {
      claimedRole = body.role.trim().replace(/\s+/g, " ").slice(0, 40);
    }
  } catch {
    // ignore — empty body is allowed
  }

  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, kind, permission, spots, archived, expires_at, roles")
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

  // Validate the claimed role label, if one was sent. Must exist in the
  // card's predefined roles and not be taken by someone else.
  if (claimedRole) {
    const labels: string[] = Array.isArray(card.roles)
      ? (card.roles as unknown[])
          .map((r) =>
            typeof r === "string"
              ? r
              : r && typeof r === "object" && typeof (r as { label?: unknown }).label === "string"
                ? (r as { label: string }).label
                : "",
          )
          .filter(Boolean)
      : [];
    const lc = claimedRole.toLowerCase();
    const matched = labels.find((l) => l.toLowerCase() === lc);
    if (!matched)
      return NextResponse.json({ error: "unknown_role" }, { status: 400 });
    // Use the card's canonical casing so the joiner row matches the label.
    claimedRole = matched;

    const { data: takers } = await admin
      .from("joiners")
      .select("user_id, role")
      .eq("card_id", params.id);
    const otherHolder = (takers || []).find(
      (t) =>
        (t as { user_id: string }).user_id !== userId &&
        ((t as { role?: string }).role || "").toLowerCase() === lc,
    );
    if (otherHolder)
      return NextResponse.json({ error: "role_taken" }, { status: 400 });
  }

  if (card.permission === "public") {
    // Cap by spots — but joiners who already have a row (e.g. re-claiming a
    // different role) don't count again.
    const { count } = await admin
      .from("joiners")
      .select("user_id", { head: true, count: "exact" })
      .eq("card_id", params.id);
    const { data: mine } = await admin
      .from("joiners")
      .select("user_id")
      .eq("card_id", params.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mine && (count ?? 0) >= card.spots)
      return NextResponse.json({ error: "full" }, { status: 400 });
    const { error } = await admin
      .from("joiners")
      .upsert(
        { card_id: params.id, user_id: userId, role: claimedRole },
        { onConflict: "card_id,user_id" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "joined", role: claimedRole });
  }

  // request mode — role is ignored; the owner picks at accept time.
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
