import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import { apiServerError } from "@/lib/api/serverError";
import { SINGLE_ACTIVE_RULES } from "@/lib/stateDedup";
import { isAssetPathForSpace, takePersistentRateLimit } from "@/lib/server/uploadSecurity";
import { getProjectAccess } from "@/lib/server/projectAccess";
import { appendStateLimit, hasStateCapacity, type LimitedStateKind } from "@/lib/server/stateLimits";
import { removeAssetPaths } from "@/lib/server/storage";
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
 *   upload  — record a stored file. data: { path or url, name, size?, mimeType? }
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
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_WRITES = 120;
const stateWriteBuckets = new Map<string, { startedAt: number; count: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  if (stateWriteBuckets.size > 2000) {
    for (const [bucketKey, bucket] of stateWriteBuckets) {
      if (now - bucket.startedAt > RATE_WINDOW_MS) stateWriteBuckets.delete(bucketKey);
    }
  }
  const bucket = stateWriteBuckets.get(key);
  if (!bucket || now - bucket.startedAt > RATE_WINDOW_MS) {
    stateWriteBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX_WRITES;
}

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

function editRpcUnavailable(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "PGRST202"
    || value?.code === "42883"
    || (value?.message || "").includes("upsert_module_edit");
}

export async function POST(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
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
  const stateKind = kind as ModuleStateKind;
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

  if (!checkRateLimit(`${params.id}:${actorKind}:${actorId}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const admin = supabaseAdmin();
  const persistentAllowed = await takePersistentRateLimit(admin, `state:${params.id}:${actorKind}:${actorId}`, 60, RATE_MAX_WRITES);
  if (!persistentAllowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Signed-in contributors get their real name (and colour) from their
  // profile, so elements show "Leon" instead of an empty "anon"/"?".
  if (actorKind === "user") {
    const { data: prof } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", actorId)
      .maybeSingle();
    const profName = typeof prof?.display_name === "string" ? prof.display_name.trim() : "";
    if (profName) displayName = profName.slice(0, 40);
  }

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
  // Suite projects accept signed owners/members. Anonymous collaboration is
  // available only while the explicit share link is enabled.
  if (space.stage) {
    const role = actorKind === "user"
      ? await getProjectAccess(admin, {
          spaceId: params.id,
          ownerId: space.owner_id,
          shared: space.shared,
          userId: actorId,
        })
      : (space.shared ? "link" : "none");
    if (role === "none") return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }

  const appendLimit = appendStateLimit(stateKind);
  if (appendLimit !== null) {
    try {
      const hasCapacity = await hasStateCapacity(
        admin,
        params.id,
        moduleIndex,
        stateKind as LimitedStateKind,
      );
      if (!hasCapacity) {
        return NextResponse.json(
          { error: "state_limit_reached", kind: stateKind, limit: appendLimit },
          { status: 409 },
        );
      }
    } catch (error) {
      console.error("[state] capacity check failed:", (error as Error).message);
      return NextResponse.json({ error: "state_check_failed" }, { status: 500 });
    }
  }

  // ── vote ──────────────────────────────────────────────────────────────
  if (kind === "vote") {
    const option = typeof data.option === "string" ? (data.option as string).trim().slice(0, 80) : "";
    // Always delete any prior vote for this actor+module.
    const { error: deleteErr } = await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "vote")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId);
    if (deleteErr) {
      console.error("[state] vote cleanup failed:", deleteErr.message);
      return NextResponse.json({ error: "state_cleanup_failed" }, { status: 500 });
    }
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
    if (error) return apiServerError("state_write_failed", "state/vote", error);
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
    const { error: deleteErr } = await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "check")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .filter(`data->>${SINGLE_ACTIVE_RULES.check.scopeField}`, "eq", itemKey);
    if (deleteErr) {
      console.error("[state] check cleanup failed:", deleteErr.message);
      return NextResponse.json({ error: "state_cleanup_failed" }, { status: 500 });
    }

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
      if (error) return apiServerError("state_write_failed", "state/check", error);
    }
    return NextResponse.json({ ok: true });
  }

  // ── claim ─────────────────────────────────────────────────────────────
  if (kind === "claim") {
    const slotLabel = typeof data.slotLabel === "string" ? (data.slotLabel as string).slice(0, 80) : "";
    if (!slotLabel) return NextResponse.json({ error: "slot_label_required" }, { status: 400 });
    const claiming = data.claimed !== false; // default true; false = unclaim

    // Delete existing claim for this (actor, slot).
    const { error: deleteErr } = await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "claim")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .filter(`data->>${SINGLE_ACTIVE_RULES.claim.scopeField}`, "eq", slotLabel);
    if (deleteErr) {
      console.error("[state] claim cleanup failed:", deleteErr.message);
      return NextResponse.json({ error: "state_cleanup_failed" }, { status: 500 });
    }

    if (!claiming) return NextResponse.json({ ok: true }); // unclaim = just delete

    // Check if another actor already holds this slot.
    const { data: holders, error: holdersErr } = await admin
      .from("module_state")
      .select("actor_kind, actor_id")
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "claim")
      .filter(`data->>${SINGLE_ACTIVE_RULES.claim.scopeField}`, "eq", slotLabel);
    if (holdersErr) {
      console.error("[state] claim holder check failed:", holdersErr.message);
      return NextResponse.json({ error: "state_check_failed" }, { status: 500 });
    }
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
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "slot_taken" }, { status: 409 });
      }
      return apiServerError("state_write_failed", "state/claim", error);
    }
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
    if (error) return apiServerError("state_write_failed", "state/voice", error);
    return NextResponse.json({ ok: true });
  }

  // ── edit ──────────────────────────────────────────────────────────────
  if (kind === "edit") {
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "edit_empty" }, { status: 400 });
    }
    const itemId = typeof data.id === "string" ? data.id.trim().slice(0, 120) : "";

    // Removing an upload should remove the actual object and row, not append a
    // tombstone forever. This also releases the project's storage quota.
    if (itemId && data.deleted === true) {
      const { data: target, error: targetError } = await admin
        .from("module_state")
        .select("id, kind, data")
        .eq("id", itemId)
        .eq("space_id", params.id)
        .eq("module_index", moduleIndex)
        .maybeSingle();
      if (targetError) return NextResponse.json({ error: "state_check_failed" }, { status: 500 });
      if (target?.kind === "upload") {
        const path = typeof target.data?.path === "string" ? target.data.path : "";
        try {
          if (path && isAssetPathForSpace(params.id, path)) await removeAssetPaths(admin, [path]);
        } catch (error) {
          console.error("[state] asset removal failed:", (error as Error).message);
          return NextResponse.json({ error: "asset_delete_failed" }, { status: 500 });
        }
        const { error: deleteError } = await admin.from("module_state").delete().eq("id", itemId);
        if (deleteError) return NextResponse.json({ error: "state_cleanup_failed" }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
    }

    const rowId = newId();
    if (itemId) {
      const { error: rpcError } = await admin.rpc("upsert_module_edit", {
        p_id: rowId,
        p_space_id: params.id,
        p_module_index: moduleIndex,
        p_actor_kind: actorKind,
        p_actor_id: actorId,
        p_display_name: displayName,
        p_data: data,
      });
      if (!rpcError) return NextResponse.json({ ok: true });
      if (!editRpcUnavailable(rpcError)) {
        console.error("[state] edit compaction failed:", rpcError.message);
        return NextResponse.json({ error: "state_write_failed" }, { status: 500 });
      }
    }

    // Migration-tolerant fallback: old databases retain append-only behavior.
    const { error } = await admin.from("module_state").insert({
      id: rowId,
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind: stateKind,
      data,
    });
    if (error) return apiServerError("state_write_failed", "state/edit", error);
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
    if (error) return apiServerError("state_write_failed", "state/add", error);
    return NextResponse.json({ ok: true });
  }

  // ── upload ────────────────────────────────────────────────────────────
  if (kind === "upload") {
    const url = typeof data.url === "string" ? (data.url as string).trim() : "";
    const path = typeof data.path === "string" ? (data.path as string).trim() : "";
    if (!url.startsWith("https://") && !path.startsWith(`${params.id}/`)) {
      return NextResponse.json({ error: "upload_reference_required" }, { status: 400 });
    }
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { ...data, ...(url ? { url } : {}), ...(path ? { path } : {}) },
    });
    if (error) return apiServerError("state_write_failed", "state/upload", error);
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
    if (error) return apiServerError("state_write_failed", "state/stroke", error);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
