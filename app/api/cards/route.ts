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

// Hard ceiling: a thing may start at most 30 days into the future. Most will
// be hours or days away — this just prevents pathological inputs.
const MAX_LEAD_MS = 30 * 86_400_000;
const MIN_LEAD_MS = 5 * 60_000; // 5 min minimum into the future

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  let body: {
    kind?: "idea" | "thing";
    title?: string;
    description?: string;
    location?: { lat: number; lng: number; label: string } | null;
    locationKind?: string | null;
    spots?: number;
    permission?: "public" | "request";
    startsAt?: string; // ISO 8601
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

  const kind: "idea" | "thing" = body.kind === "idea" ? "idea" : "thing";

  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const tags = normalizeTags(body.tags, 5);
  // Accept any CSS-style hex. Validate loosely to keep schemas honest.
  const colorRaw = (body.color || "").trim();
  const color = /^#([0-9a-fA-F]{3}){1,2}$/.test(colorRaw) ? colorRaw.toLowerCase() : null;

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

  // ----- Optional location (validated when present) -----
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

  // Optional draft module — sanitized per the typed union. Caps to ONE
  // module on a thing; ideas don't carry modules (the field is dropped
  // silently below if kind === "idea").
  const modules = Array.isArray(body.modules) ? sanitizeModules(body.modules) : [];

  // Optional predefined role labels — only persisted on things. Sanitizer
  // dedupes case-insensitively, caps to 8.
  const roleLabels = Array.isArray(body.roles) ? sanitizeRoleLabels(body.roles) : [];

  // Photon classification of the picked place. We only keep simple
  // lowercase tokens (osm_value vocab); anything weird is dropped.
  const locationKind =
    typeof body.locationKind === "string" && /^[a-z][a-z0-9_-]{1,31}$/i.test(body.locationKind)
      ? body.locationKind.toLowerCase()
      : null;

  await ensureProfile(userId);
  const admin = supabaseAdmin();
  const id = newId();

  // ============================================================
  // IDEA — a thought thrown into the field. Cheap, low-commitment.
  // Everything except the title is optional: no time, no spots, no
  // permission. An optional loose location is allowed. Ideas do NOT
  // auto-archive a live thing — they coexist; many ideas just float.
  // ============================================================
  if (kind === "idea") {
    const { data, error } = await admin
      .from("cards")
      .insert({
        id,
        kind: "idea",
        owner_id: userId,
        title,
        description,
        location,          // may be null
        location_kind: locationKind,
        spots: null,
        permission: null,
        tags,
        color,
        expires_at: null,  // ideas don't expire
        ends_at: null,
        duration_days: null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fire-and-forget: compute the design signature in the background.
    // The card returns immediately; the signature lands on the row a
    // moment later and the UI picks it up on next fetch.
    regenerateSignatureInBackground(
      id,
      { title, description, tags },
      async (cardId, sig) => {
        await admin.from("cards").update({ signature: sig }).eq("id", cardId);
      },
    );

    return NextResponse.json({ ok: true, id, kind: "idea", card: data });
  }

  // ============================================================
  // THING — concrete, joinable. Needs enough to be joinable: a title,
  // a location, a start time, and a spot count.
  // ============================================================
  const spots = Math.max(1, Math.min(99, Math.floor(body.spots || 1)));
  const permission = body.permission === "request" ? "request" : "public";

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

  // Optional end time. Must be after start; cap a 24h window after start to
  // keep "things" event-shaped rather than open calendars.
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

  // Multiple live things per person are allowed. The "one per week" rhythm
  // is gone — Creator.Paris is now a project-board, not a weekly slot. The
  // shape of the city emerges from how many things you actually carry.

  const { data, error } = await admin
    .from("cards")
    .insert({
      id,
      kind: "thing",
      owner_id: userId,
      title,
      description,
      location,
      spots,
      permission,
      tags,
      color,
      // `expires_at` column is repurposed: it now stores the event START time.
      // Things auto-hide once this passes. `duration_days` is vestigial; we
      // send 1 to keep parity with legacy rows.
      duration_days: 1,
      expires_at: new Date(startsMs).toISOString(),
      ends_at: endsMs ? new Date(endsMs).toISOString() : null,
      modules,
      roles: rolesForStorage(roleLabels),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: compute the design signature in the background.
  regenerateSignatureInBackground(
    id,
    {
      title,
      description,
      tags,
      module: modules[0],
    },
    async (cardId, sig) => {
      await admin.from("cards").update({ signature: sig }).eq("id", cardId);
    },
  );

  return NextResponse.json({ ok: true, id, kind: "thing", card: data });
}
