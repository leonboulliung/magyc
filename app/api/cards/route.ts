import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { newId } from "@/lib/id";
import { normalizeTags } from "@/lib/vibe";
import { isBanned } from "@/lib/server/safety";
import { sanitizeModules } from "@/lib/server/moduleSanitize";
import { rolesForStorage, sanitizeRoleLabels } from "@/lib/server/roleSanitize";
import { regenerateSignatureInBackground } from "@/lib/server/signatureCompute";

// Hard ceiling: a card with a start time may sit at most 30 days in the
// future. The lower bound is 5 min — anything sooner is most likely a typo.
const MAX_LEAD_MS = 30 * 86_400_000;
const MIN_LEAD_MS = 5 * 60_000;

/**
 * POST /api/cards — create a card.
 *
 * Every field except `title` is optional. The AI composer can fill the
 * rest in, the user can iterate, or the card stays minimal forever.
 * The old idea/thing split is gone; a card with no startsAt is just an
 * open-ended card (formerly known as an idea).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  let body: {
    title?: string;
    description?: string;
    location?: { lat: number; lng: number; label: string } | null;
    locationKind?: string | null;
    spots?: number | null;
    permission?: "public" | "request";
    startsAt?: string | null; // ISO 8601
    endsAt?: string | null;
    tags?: string[];
    color?: string;
    modules?: unknown[];
    roles?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  const description = (body.description || "").trim();
  const tags = normalizeTags(body.tags, 5);
  const colorRaw = (body.color || "").trim();
  const color = /^#([0-9a-fA-F]{3}){1,2}$/.test(colorRaw) ? colorRaw.toLowerCase() : null;

  // Optional location — validated when present.
  let location: { lat: number; lng: number; label: string } | null = null;
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

  // Photon classification of the picked place — lowercase tokens only.
  const locationKind =
    typeof body.locationKind === "string" && /^[a-z][a-z0-9_-]{1,31}$/i.test(body.locationKind)
      ? body.locationKind.toLowerCase()
      : null;

  // Optional spots cap (members beyond this are blocked from joining).
  const spots =
    typeof body.spots === "number" && body.spots > 0
      ? Math.max(1, Math.min(99, Math.floor(body.spots)))
      : null;
  const permission =
    body.permission === "request" ? "request" : "public";

  // Optional start / end times. If startsAt is provided, validate.
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  if (body.startsAt) {
    const startsMs = Date.parse(body.startsAt);
    if (!Number.isFinite(startsMs)) {
      return NextResponse.json({ error: "starts_at_invalid" }, { status: 400 });
    }
    const now = Date.now();
    if (startsMs < now + MIN_LEAD_MS) {
      return NextResponse.json({ error: "starts_at_too_soon" }, { status: 400 });
    }
    if (startsMs > now + MAX_LEAD_MS) {
      return NextResponse.json({ error: "starts_at_too_far" }, { status: 400 });
    }
    startsAt = new Date(startsMs).toISOString();
    if (body.endsAt) {
      const endsMs = Date.parse(body.endsAt);
      if (Number.isFinite(endsMs)) {
        if (endsMs <= startsMs) {
          return NextResponse.json({ error: "ends_at_before_start" }, { status: 400 });
        }
        if (endsMs > startsMs + 24 * 60 * 60 * 1000) {
          return NextResponse.json({ error: "ends_at_too_far" }, { status: 400 });
        }
        endsAt = new Date(endsMs).toISOString();
      }
    }
  }

  // Optional draft module — sanitized per the typed union.
  const modules = Array.isArray(body.modules) ? sanitizeModules(body.modules) : [];

  // Optional predefined role labels.
  const roleLabels = Array.isArray(body.roles) ? sanitizeRoleLabels(body.roles) : [];

  await ensureProfile(userId);
  const admin = supabaseAdmin();
  const id = newId();

  const { data, error } = await admin
    .from("cards")
    .insert({
      id,
      owner_id: userId,
      title,
      description,
      location,
      location_kind: locationKind,
      spots,
      permission,
      tags,
      color,
      starts_at: startsAt,
      ends_at: endsAt,
      modules,
      roles: rolesForStorage(roleLabels),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: compute the design signature in the background.
  regenerateSignatureInBackground(
    id,
    { title, description, tags, module: modules[0] },
    async (cardId, sig) => {
      await admin.from("cards").update({ signature: sig }).eq("id", cardId);
    },
  );

  return NextResponse.json({ ok: true, id, card: data });
}
