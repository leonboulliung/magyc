import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId } from "@/lib/id";
import { isBanned } from "@/lib/server/safety";

// Hard ceiling mirrors POST /api/cards — a thing starts within 30 days.
const MAX_LEAD_MS = 30 * 86_400_000;
const MIN_LEAD_MS = 5 * 60_000;

/**
 * The transformation: idea → thing. A deliberate human act. Two flavors:
 *
 *   • OWNER transform — the idea-owner promotes their own idea. We flip
 *     `kind` on the SAME row, so existing /post/[id] links survive.
 *     Signalers become invited crew. The idea becomes the thing.
 *
 *   • FORK transform — anyone else turns the idea into THEIR thing. The
 *     original idea stays untouched (and can be forked again by others).
 *     A new card row is created, owned by the forker, carrying an
 *     immutable credit ("abstammt aus @owner — idea title"). The
 *     original owner + every signaler land as invited crew on the new
 *     thing — the resonance follows.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  const admin = supabaseAdmin();

  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, kind, archived, location, title, description, tags, color")
    .eq("id", params.id)
    .maybeSingle();
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (card.kind !== "idea")
    return NextResponse.json({ error: "not_an_idea" }, { status: 400 });
  if (card.archived)
    return NextResponse.json({ error: "archived" }, { status: 400 });

  const isOwner = card.owner_id === userId;

  const body = (await req.json().catch(() => ({}))) as {
    location?: { lat: number; lng: number; label: string } | null;
    spots?: number;
    permission?: "public" | "request";
    startsAt?: string;
    endsAt?: string | null;
  };

  // Location: use the supplied one, else fall back to the idea's loose location.
  let location = card.location as { lat: number; lng: number; label: string } | null;
  if (
    body.location &&
    typeof body.location.lat === "number" &&
    typeof body.location.lng === "number" &&
    body.location.label
  ) {
    location = {
      lat: body.location.lat,
      lng: body.location.lng,
      label: String(body.location.label).slice(0, 160),
    };
  }
  if (!location) {
    return NextResponse.json({ error: "location_required" }, { status: 400 });
  }

  const startsMs = body.startsAt ? Date.parse(body.startsAt) : NaN;
  if (!Number.isFinite(startsMs)) {
    return NextResponse.json({ error: "starts_at_required" }, { status: 400 });
  }
  const now = Date.now();
  if (startsMs < now + MIN_LEAD_MS) {
    return NextResponse.json({ error: "starts_at_too_soon" }, { status: 400 });
  }
  if (startsMs > now + MAX_LEAD_MS) {
    return NextResponse.json({ error: "starts_at_too_far" }, { status: 400 });
  }

  let endsMs: number | null = null;
  if (body.endsAt) {
    const t = Date.parse(body.endsAt);
    if (Number.isFinite(t)) {
      if (t <= startsMs) {
        return NextResponse.json({ error: "ends_at_before_start" }, { status: 400 });
      }
      if (t > startsMs + 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "ends_at_too_far" }, { status: 400 });
      }
      endsMs = t;
    }
  }

  const spots = Math.max(1, Math.min(99, Math.floor(body.spots || 1)));
  const permission = body.permission === "request" ? "request" : "public";

  // ----------------------------------------------------------------
  // OWNER PATH — in-place flip on the same row.
  // ----------------------------------------------------------------
  if (isOwner) {
    // One live thing per person: archive any OTHER active thing this user
    // owns (not this row — it's about to become the live thing).
    await admin
      .from("cards")
      .update({ archived: true })
      .eq("owner_id", userId)
      .eq("kind", "thing")
      .eq("archived", false)
      .neq("id", params.id);

    const { error: upErr } = await admin
      .from("cards")
      .update({
        kind: "thing",
        location,
        spots,
        permission,
        duration_days: 1,
        expires_at: new Date(startsMs).toISOString(),
        ends_at: endsMs ? new Date(endsMs).toISOString() : null,
      })
      .eq("id", params.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: signalRows } = await admin
      .from("signals")
      .select("user_id")
      .eq("card_id", params.id);

    const invited = (signalRows || [])
      .map((s) => s.user_id as string)
      .filter((uid) => uid && uid !== userId);

    if (invited.length > 0) {
      await admin
        .from("join_requests")
        .upsert(
          invited.map((user_id) => ({ card_id: params.id, user_id })),
          { onConflict: "card_id,user_id" },
        );
    }

    // Signals served their purpose on the now-thing.
    await admin.from("signals").delete().eq("card_id", params.id);

    return NextResponse.json({
      ok: true,
      id: params.id,
      kind: "thing",
      forked: false,
      invitedCount: invited.length,
    });
  }

  // ----------------------------------------------------------------
  // FORK PATH — a different user makes this idea into THEIR thing.
  // Original idea stays as-is. A new card is born.
  // ----------------------------------------------------------------

  // Auto-archive forker's existing active thing (the 1-thing-live rule).
  await admin
    .from("cards")
    .update({ archived: true })
    .eq("owner_id", userId)
    .eq("kind", "thing")
    .eq("archived", false);

  const newCardId = newId();

  const { error: insErr } = await admin.from("cards").insert({
    id: newCardId,
    kind: "thing",
    owner_id: userId,
    title: card.title,
    description: card.description || "",
    tags: Array.isArray(card.tags) ? card.tags : [],
    color: card.color,
    location,
    spots,
    permission,
    duration_days: 1,
    expires_at: new Date(startsMs).toISOString(),
    ends_at: endsMs ? new Date(endsMs).toISOString() : null,
    // The credit: immutable, snapshot, survives idea deletion.
    forked_from_card_id: card.id,
    forked_from_owner_id: card.owner_id,
    forked_from_title: card.title,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Invited crew: the original idea-owner + every signaler.
  // The forker themselves is the creator (joiners auto-row), so skip them
  // and skip duplicates. Written as join_requests so the forker keeps a
  // light accept/decline gate, and the invitees see a warm pending invite.
  const { data: signalRows } = await admin
    .from("signals")
    .select("user_id")
    .eq("card_id", card.id);

  const inviteeIds = new Set<string>();
  inviteeIds.add(card.owner_id);
  for (const row of signalRows || []) {
    if (row.user_id) inviteeIds.add(row.user_id as string);
  }
  inviteeIds.delete(userId); // don't invite the forker to their own crew

  const invited = Array.from(inviteeIds);
  if (invited.length > 0) {
    await admin
      .from("join_requests")
      .upsert(
        invited.map((user_id) => ({ card_id: newCardId, user_id })),
        { onConflict: "card_id,user_id" },
      );
  }

  // The original idea is INTENTIONALLY untouched: its signals, its kind,
  // its row all stay. Others can fork it too, or the owner can still
  // promote it themselves.

  return NextResponse.json({
    ok: true,
    id: newCardId,
    kind: "thing",
    forked: true,
    invitedCount: invited.length,
  });
}
