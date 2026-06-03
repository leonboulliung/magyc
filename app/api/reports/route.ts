import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId } from "@/lib/id";

const VALID_REASONS = new Set([
  "spam",
  "harassment",
  "unsafe",
  "impersonation",
  "off-topic",
  "other",
]);

// Light cooldown — one report every 10s per user, so a misclick doesn't
// flood the queue. The queue itself is admin-only, but we still don't
// want noise piling up.
const lastReportAt = new Map<string, number>();
const COOLDOWN_MS = 10_000;

/**
 * Submit a report against a card or another profile. Anyone signed in
 * can report. Self-reports are blocked. Reports are private — only the
 * admin queue ever reads them.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    targetKind?: "card" | "profile";
    targetId?: string;
    reason?: string;
    detail?: string;
  };

  if (body.targetKind !== "card" && body.targetKind !== "profile") {
    return NextResponse.json({ error: "bad_target_kind" }, { status: 400 });
  }
  if (typeof body.targetId !== "string" || !body.targetId.trim()) {
    return NextResponse.json({ error: "bad_target_id" }, { status: 400 });
  }
  const reason = String(body.reason || "").trim().toLowerCase();
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "bad_reason" }, { status: 400 });
  }

  const now = Date.now();
  const last = lastReportAt.get(userId) || 0;
  if (now - last < COOLDOWN_MS) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const admin = supabaseAdmin();

  // Resolve the target's profile id (and reject self-reports).
  let targetProfileId: string | null = null;
  let targetCardId: string | null = null;
  if (body.targetKind === "card") {
    const { data: card } = await admin
      .from("cards")
      .select("id, owner_id")
      .eq("id", body.targetId)
      .maybeSingle();
    if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (card.owner_id === userId)
      return NextResponse.json({ error: "self_report" }, { status: 400 });
    targetCardId = card.id;
  } else {
    if (body.targetId === userId)
      return NextResponse.json({ error: "self_report" }, { status: 400 });
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", body.targetId)
      .maybeSingle();
    if (!prof) return NextResponse.json({ error: "not_found" }, { status: 404 });
    targetProfileId = prof.id;
  }

  const detail = typeof body.detail === "string"
    ? body.detail.trim().slice(0, 500)
    : null;

  const { error } = await admin.from("reports").insert({
    id: newId(),
    reporter_id: userId,
    target_kind: body.targetKind,
    target_card_id: targetCardId,
    target_profile_id: targetProfileId,
    reason,
    detail,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  lastReportAt.set(userId, now);
  return NextResponse.json({ ok: true });
}
