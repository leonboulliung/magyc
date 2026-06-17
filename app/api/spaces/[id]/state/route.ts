import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import type { ModuleStateKind } from "@/lib/types";

/**
 * POST /api/spaces/[id]/state — record a collaborative action against
 * a specific module on a specific space.
 *
 *   Body: {
 *     moduleIndex: number,
 *     kind: ModuleStateKind,
 *     data: { ... }            // shape depends on kind (see below)
 *     anonToken?: string,      // present when not signed in
 *     anonName?: string,       // optional display name for anon actor
 *   }
 *
 * Kind semantics:
 *   vote    — one active vote per actor per module. Empty option = remove.
 *   check   — toggle. data: { itemKey: string, checked: bool }
 *   claim   — one actor per slot. data: { slotLabel, claimed? }
 *             claimed: false = unclaim (delete existing).
 *   voice   — append message. data: { id, text, role?, parentId? }
 *   edit    — last-write-wins. data: arbitrary (text, id, etc.)
 *   add     — append item. data: arbitrary (text, id, imageUrl, etc.)
 *   upload  — record a stored file. data: { url, name, size?, mimeType? }
 *   stroke  — append canvas stroke. data: { path, color? }
 */

const ALLOWED_KINDS: ReadonlySet<ModuleStateKind> = new Set([
  "vote", "check", "claim", "voice", "edit", "add", "upload", "stroke",
]);

/** Maximum number of bytes we allow in the data blob. Generous enough
 *  for a single sketch stroke's SVG path (which can be long) while
 *  still far below any base64 image — those never travel through state
 *  (uploads store a Storage URL, not the blob). */
const MAX_DATA_BYTES = 48_000;
/** Per-string cap. Sketch paths are the one legitimate long string. */
const MAX_STRING_LEN = 44_000;

/** Sanitise a data blob — cap total serialized size, keep shape. */
function sanitizeData(d: unknown): Record<string, unknown> {
  if (!d || typeof d !== "object" || Array.isArray(d)) return {};
  const raw = d as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.length > MAX_STRING_LEN) continue; // cap strings
    if (typeof v === "object" && v !== null) continue;                // no nested objs
    out[k] = v;
  }
  const serialized = JSON.stringify(out);
  if (serialized.length > MAX_DATA_BYTES) return {};
  return out;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = await parseBody(req, z.object({
    moduleIndex: z.number().optional(),
    kind: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    anonToken: z.string().optional(),
    anonName: z.string().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const moduleIndex = typeof body.moduleIndex === "number" ? Math.floor(body.moduleIndex) : -1;
  if (moduleIndex < 0 || moduleIndex > 64) {
    return NextResponse.json({ error: "bad_module_index" }, { status: 400 });
  }
  const kind = body.kind;
  if (typeof kind !== "string" || !ALLOWED_KINDS.has(kind as ModuleStateKind)) {
    return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  }
  const rawData = body.data && typeof body.data === "object" ? body.data : {};
  const data = sanitizeData(rawData);

  // Identify actor.
  const { userId } = await auth();
  let actorKind: "user" | "anon";
  let actorId: string;
  let displayName: string | null = null;

  if (userId) {
    actorKind = "user";
    actorId = userId;
    displayName = (body.anonName && body.anonName.trim().slice(0, 40)) || null;
  } else {
    const token = typeof body.anonToken === "string" ? body.anonToken.trim() : "";
    if (token.length < 16) {
      return NextResponse.json({ error: "anon_token_required" }, { status: 401 });
    }
    actorKind = "anon";
    actorId = token.slice(0, 64);
    displayName = (body.anonName && body.anonName.trim().slice(0, 40)) || null;
  }

  const admin = supabaseAdmin();

  // Verify space + module index exist.
  const { data: space } = await admin
    .from("spaces")
    .select("id, modules, stage, shared, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!Array.isArray(space.modules) || moduleIndex >= space.modules.length) {
    return NextResponse.json({ error: "module_out_of_range" }, { status: 400 });
  }
  // Private suite project (stage set, not shared): only the owner may
  // contribute. Once shared, anyone with the link contributes as today.
  if (space.stage && !space.shared && (actorKind !== "user" || actorId !== space.owner_id)) {
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }

  // ── vote ──────────────────────────────────────────────────────────────
  if (kind === "vote") {
    const option = typeof data.option === "string" ? (data.option as string).trim().slice(0, 80) : "";
    // Always delete any prior vote for this actor+module.
    await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "vote")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId);
    // Empty option = toggle off (just delete).
    if (!option) return NextResponse.json({ ok: true });
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { ...data, option },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── check ─────────────────────────────────────────────────────────────
  if (kind === "check") {
    // Accepts itemKey (string) for the new checklist, or itemIndex
    // (number) for any legacy path. Both stored as itemKey.
    const itemKey =
      typeof data.itemKey === "string" ? (data.itemKey as string).slice(0, 80) :
      typeof data.itemIndex === "number" ? `seed-${Math.floor(data.itemIndex as number)}` : "";
    if (!itemKey) return NextResponse.json({ error: "item_key_required" }, { status: 400 });
    const checked = !!data.checked;

    // Delete prior check for this (actor, item).
    await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "check")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .filter("data->>itemKey", "eq", itemKey);

    if (checked) {
      const { error } = await admin.from("module_state").insert({
        id: newId(),
        space_id: params.id,
        module_index: moduleIndex,
        actor_kind: actorKind,
        actor_id: actorId,
        display_name: displayName,
        kind,
        data: { ...data, itemKey, checked: true },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── claim ─────────────────────────────────────────────────────────────
  if (kind === "claim") {
    const slotLabel = typeof data.slotLabel === "string" ? (data.slotLabel as string).slice(0, 80) : "";
    if (!slotLabel) return NextResponse.json({ error: "slot_label_required" }, { status: 400 });
    const claiming = data.claimed !== false; // default true; false = unclaim

    // Delete existing claim for this (actor, slot).
    await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "claim")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .filter("data->>slotLabel", "eq", slotLabel);

    if (!claiming) return NextResponse.json({ ok: true }); // unclaim = just delete

    // Check if another actor already holds this slot.
    const { data: holders } = await admin
      .from("module_state")
      .select("actor_kind, actor_id")
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "claim")
      .filter("data->>slotLabel", "eq", slotLabel);
    const takenByOther = (holders || []).some(
      (h) => !(h.actor_kind === actorKind && h.actor_id === actorId),
    );
    if (takenByOther) return NextResponse.json({ error: "slot_taken" }, { status: 409 });

    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { ...data, slotLabel, claimed: true },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── voice ─────────────────────────────────────────────────────────────
  if (kind === "voice") {
    const text = typeof data.text === "string" ? (data.text as string).trim().slice(0, 2000) : "";
    if (!text) return NextResponse.json({ error: "voice_text_required" }, { status: 400 });
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      // Persist full data so id / role / parentId travel with the row.
      data: { ...data, text },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── edit ──────────────────────────────────────────────────────────────
  if (kind === "edit") {
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "edit_empty" }, { status: 400 });
    }
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── add ───────────────────────────────────────────────────────────────
  if (kind === "add") {
    // Accept any non-empty data; callers use different field names
    // (text, name, value, …). We just persist the blob.
    const hasContent = Object.values(data).some(
      (v) => v !== null && v !== undefined && v !== "",
    );
    if (!hasContent) return NextResponse.json({ error: "add_empty" }, { status: 400 });
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── upload ────────────────────────────────────────────────────────────
  if (kind === "upload") {
    const url = typeof data.url === "string" ? (data.url as string).trim() : "";
    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "upload_url_required" }, { status: 400 });
    }
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { ...data, url },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── stroke ────────────────────────────────────────────────────────────
  if (kind === "stroke") {
    // A mark is either a freehand path (pen/eraser) or a shape/text with
    // its own geometry. Accept any of those; reject empty blobs.
    const type = typeof data.type === "string" ? (data.type as string) : "path";
    const validStroke =
      (typeof data.path === "string" && (data.path as string).length > 0) ||
      (type === "text" && typeof data.text === "string" && (data.text as string).trim().length > 0) ||
      ((type === "line" || type === "rect" || type === "ellipse") &&
        (typeof data.x === "number" || typeof data.x1 === "number"));
    if (!validStroke) {
      return NextResponse.json({ error: "stroke_invalid" }, { status: 400 });
    }
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
