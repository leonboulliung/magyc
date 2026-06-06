import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId } from "@/lib/id";
import type { ModuleStateKind } from "@/lib/types";

/**
 * POST /api/spaces/[id]/state — record a collaborative action against
 * a specific module on a specific space.
 *
 *   Body: {
 *     moduleIndex: number,
 *     kind: 'vote' | 'check' | 'claim' | 'voice' | 'edit' | 'add',
 *     data: { ... }            // depends on kind
 *     anonToken?: string,      // present when not signed in
 *     anonName?: string,       // optional display name for anon actor
 *   }
 *
 * Authentication: a Clerk session takes priority. If not signed in,
 * the anonToken is the actor identity. Both flows store a `display_name`
 * snapshot so renaming later doesn't retroactively change attribution.
 */

const ALLOWED_KINDS: ReadonlySet<ModuleStateKind> = new Set([
  "vote", "check", "claim", "voice", "edit", "add",
]);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: {
    moduleIndex?: unknown;
    kind?: unknown;
    data?: Record<string, unknown>;
    anonToken?: string;
    anonName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const moduleIndex = typeof body.moduleIndex === "number" ? Math.floor(body.moduleIndex) : -1;
  if (moduleIndex < 0 || moduleIndex > 32) {
    return NextResponse.json({ error: "bad_module_index" }, { status: 400 });
  }
  const kind = body.kind;
  if (typeof kind !== "string" || !ALLOWED_KINDS.has(kind as ModuleStateKind)) {
    return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  }
  const data = (body.data && typeof body.data === "object") ? body.data : {};

  // Identify actor.
  const { userId } = await auth();
  let actorKind: "user" | "anon";
  let actorId: string;
  let displayName: string | null = null;

  if (userId) {
    actorKind = "user";
    actorId = userId;
    // We could look the display name up from Clerk here — for now we
    // accept what the client passes via anonName as a fallback hint.
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

  // Per-kind data validation + uniqueness behavior.
  const admin = supabaseAdmin();

  // Verify the module index exists on the space.
  const { data: space } = await admin
    .from("spaces")
    .select("id, modules")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!Array.isArray(space.modules) || moduleIndex >= space.modules.length) {
    return NextResponse.json({ error: "module_out_of_range" }, { status: 400 });
  }

  // Vote / check / claim are SINGLE-ACTION per actor per (module, key).
  // We delete the prior row, then insert the new one — effectively
  // toggle semantics from the client's perspective.
  if (kind === "vote") {
    const option = typeof data.option === "string" ? data.option.slice(0, 80) : "";
    if (!option) return NextResponse.json({ error: "vote_option_required" }, { status: 400 });
    await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "vote")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId);
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { option },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (kind === "check") {
    const itemIndex = typeof data.itemIndex === "number" ? Math.floor(data.itemIndex) : -1;
    if (itemIndex < 0 || itemIndex > 64) {
      return NextResponse.json({ error: "bad_item_index" }, { status: 400 });
    }
    const checked = !!data.checked;
    // Delete any prior tick on this (item, actor) — the latest wins.
    await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "check")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .filter("data->>itemIndex", "eq", String(itemIndex));
    if (checked) {
      const { error } = await admin.from("module_state").insert({
        id: newId(),
        space_id: params.id,
        module_index: moduleIndex,
        actor_kind: actorKind,
        actor_id: actorId,
        display_name: displayName,
        kind,
        data: { itemIndex, checked: true },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "claim") {
    const slotLabel = typeof data.slotLabel === "string" ? data.slotLabel.slice(0, 80) : "";
    if (!slotLabel) return NextResponse.json({ error: "slot_label_required" }, { status: 400 });
    // One claim per slot — reject if another actor already holds it.
    const { data: holders } = await admin
      .from("module_state")
      .select("actor_kind, actor_id, data")
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "claim")
      .filter("data->>slotLabel", "eq", slotLabel);
    const otherHolder = (holders || []).find(
      (h) => !(h.actor_kind === actorKind && h.actor_id === actorId),
    );
    if (otherHolder) return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    // Idempotent for the same actor.
    await admin
      .from("module_state")
      .delete()
      .eq("space_id", params.id)
      .eq("module_index", moduleIndex)
      .eq("kind", "claim")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .filter("data->>slotLabel", "eq", slotLabel);
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { slotLabel },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (kind === "voice") {
    const text = typeof data.text === "string" ? data.text.trim().slice(0, 800) : "";
    if (!text) return NextResponse.json({ error: "voice_text_required" }, { status: 400 });
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { text },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (kind === "edit") {
    // Notes / stages last-write-wins. We don't dedupe — full history
    // is kept, the UI shows latest.
    const out: Record<string, unknown> = {};
    if (typeof data.text === "string") out.text = data.text.slice(0, 4000);
    if (typeof data.current === "number") out.current = Math.floor(data.current);
    if (Object.keys(out).length === 0) {
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
      data: out,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (kind === "add") {
    const value = typeof data.value === "string" ? data.value.trim().slice(0, 200) : "";
    if (!value) return NextResponse.json({ error: "add_value_required" }, { status: 400 });
    const { error } = await admin.from("module_state").insert({
      id: newId(),
      space_id: params.id,
      module_index: moduleIndex,
      actor_kind: actorKind,
      actor_id: actorId,
      display_name: displayName,
      kind,
      data: { value },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
