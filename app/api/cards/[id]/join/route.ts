import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { isBanned } from "@/lib/server/safety";

/**
 * Join (or request to join) a card.
 *
 * Body (optional): `{ role?: string }` — when set, the member claims a
 * predefined role on the card ("Ich mach's"). The label must match an
 * entry in `cards.roles` (case-insensitive) and not be taken by another
 * joined member. An empty / missing role means "just dabei".
 *
 * Permission "public"  → write `members` row with state="joined".
 * Permission "request" → write `members` row with state="requested";
 *                        the owner accepts via PATCH on members/[uid].
 *
 * A user can re-call this to switch roles. We upsert on (card,user)
 * — the second call updates their existing row's role.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  await ensureProfile(userId);
  const admin = supabaseAdmin();

  let claimedRole = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { role?: unknown };
    if (typeof body.role === "string") {
      claimedRole = body.role.trim().replace(/\s+/g, " ").slice(0, 40);
    }
  } catch {
    // empty body allowed
  }

  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, permission, spots, starts_at, roles")
    .eq("id", params.id)
    .maybeSingle();
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (card.owner_id === userId)
    return NextResponse.json({ error: "owner_cant_join" }, { status: 400 });
  // A card with a start time in the past is closed to new members.
  if (card.starts_at && new Date(card.starts_at).getTime() <= Date.now())
    return NextResponse.json({ error: "past" }, { status: 400 });

  // Validate the claimed role label, if one was sent.
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
    claimedRole = matched;

    const { data: takers } = await admin
      .from("members")
      .select("user_id, role, state")
      .eq("card_id", params.id)
      .eq("state", "joined");
    const otherHolder = (takers || []).find(
      (t) =>
        (t as { user_id: string }).user_id !== userId &&
        ((t as { role?: string }).role || "").toLowerCase() === lc,
    );
    if (otherHolder)
      return NextResponse.json({ error: "role_taken" }, { status: 400 });
  }

  // The state we'll write depends on the card's permission setting.
  // Spot-cap only applies to confirmed members.
  const targetState: "joined" | "requested" =
    card.permission === "request" ? "requested" : "joined";

  if (targetState === "joined" && card.spots != null) {
    const { count } = await admin
      .from("members")
      .select("user_id", { head: true, count: "exact" })
      .eq("card_id", params.id)
      .eq("state", "joined");
    const { data: mine } = await admin
      .from("members")
      .select("user_id, state")
      .eq("card_id", params.id)
      .eq("user_id", userId)
      .maybeSingle();
    // Already-joined members re-claiming a role don't count again.
    if (!mine && (count ?? 0) >= card.spots)
      return NextResponse.json({ error: "full" }, { status: 400 });
  }

  const { error } = await admin
    .from("members")
    .upsert(
      {
        card_id: params.id,
        user_id: userId,
        state: targetState,
        role: claimedRole,
      },
      { onConflict: "card_id,user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    status: targetState,
    role: claimedRole,
  });
}

// DELETE = leave / cancel request (the member removes themselves).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  await admin.from("members").delete().eq("card_id", params.id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
