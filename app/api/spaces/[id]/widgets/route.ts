import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { sanitizeModule, sanitizeModules } from "@/lib/modules";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import { isSpaceOwner, forbidden } from "@/lib/api/auth";
import { apiServerError } from "@/lib/api/serverError";

/**
 * POST /api/spaces/[id]/widgets
 *   Body: { widget: Module, anonOwnerToken?: string }
 *   Appends a new widget at the end of the modules array.
 *   Returns: { ok: true, index: number }
 *
 * PATCH /api/spaces/[id]/widgets
 *   Body: { modules: Module[], anonOwnerToken?: string }
 *   Replaces the FULL modules array (used for reordering).
 *   Returns: { ok: true }
 *
 * DELETE /api/spaces/[id]/widgets
 *   Body: { index: number, anonOwnerToken?: string }
 *   Removes the widget at the given index.
 *   Returns: { ok: true }
 *
 * All three require owner auth (anon token on drafts, Clerk on published).
 */

function isMissingModulesRev(error: unknown): boolean {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  return [e?.message, e?.details, e?.hint, e?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("modules_rev");
}

function readModulesRev(row: unknown): number | null {
  const rev = (row as { modules_rev?: unknown } | null)?.modules_rev;
  return typeof rev === "number" ? rev : null;
}

async function fetchWidgetSpace(admin: ReturnType<typeof supabaseAdmin>, spaceId: string) {
  const selectWithRev = "id, anon_owner_token, owner_id, visibility, modules, modules_rev";
  const selectLegacy = "id, anon_owner_token, owner_id, visibility, modules";
  const primary = await admin.from("spaces").select(selectWithRev).eq("id", spaceId).maybeSingle();
  if (!primary.error || !isMissingModulesRev(primary.error)) return primary;
  return admin.from("spaces").select(selectLegacy).eq("id", spaceId).maybeSingle();
}

/** Write the modules array. The .select() is load-bearing: without it
 *  Supabase reports success even when 0 rows matched. Returns an error
 *  response, or null on success. */
async function persistModules(
  admin: ReturnType<typeof supabaseAdmin>,
  spaceId: string,
  modules: unknown[],
  expectedRev: number | null,
): Promise<NextResponse | null> {
  let query = admin
    .from("spaces")
    .update({ modules, modules_rev: (expectedRev ?? 0) + 1 })
    .eq("id", spaceId);
  if (expectedRev !== null) query = query.eq("modules_rev", expectedRev);
  let { data, error } = await query.select("id");
  if (error && isMissingModulesRev(error)) {
    const fallback = await admin
      .from("spaces")
      .update({ modules })
      .eq("id", spaceId)
      .select("id");
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return apiServerError("save_failed", "widgets/persist", error);
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "modules_conflict" }, { status: 409 });
  }
  return null;
}

export async function POST(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  const parsed = await parseBody(req, z.object({
    widget: z.unknown().optional(),
    modulesRev: z.number().int().nonnegative().optional(),
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const widget = sanitizeModule(body.widget);
  if (!widget) return NextResponse.json({ error: "widget_invalid" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await fetchWidgetSpace(admin, params.id);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const current = Array.isArray(space.modules) ? space.modules : [];
  const next = [...current, widget];
  const newIndex = current.length;

  const expectedRev = typeof body.modulesRev === "number"
    ? body.modulesRev
    : readModulesRev(space);
  const failure = await persistModules(admin, params.id, next, expectedRev);
  if (failure) return failure;

  return NextResponse.json({ ok: true, index: newIndex, modulesRev: (expectedRev ?? 0) + 1 });
}

export async function PATCH(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  const parsed = await parseBody(req, z.object({
    modules: z.unknown().optional(),
    modulesRev: z.number().int().nonnegative().optional(),
    anonOwnerToken: z.string().nullish(),
    // order[newPosition] = oldIndex — the reorder permutation, so we can
    // remap module_state (keyed by positional index) to follow the widgets.
    order: z.array(z.number()).optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!Array.isArray(body.modules)) {
    return NextResponse.json({ error: "modules_required" }, { status: 400 });
  }
  const modules = sanitizeModules(body.modules);

  const admin = supabaseAdmin();
  const { data: space } = await fetchWidgetSpace(admin, params.id);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const expectedRev = typeof body.modulesRev === "number"
    ? body.modulesRev
    : readModulesRev(space);
  const failure = await persistModules(admin, params.id, modules, expectedRev);
  if (failure) return failure;

  // Remap module_state so collaborative rows follow their reordered widget.
  // Two-phase via a large offset: first move each changed index out to
  // oldIndex→(newPos + OFFSET), then back down to newPos. The offset keeps
  // the two passes from matching rows they've already moved (there is no
  // unique constraint on module_index, so no collision either way).
  const order = body.order;
  if (Array.isArray(order) && order.length === modules.length) {
    const OFFSET = 100_000;
    const moves: { oldIndex: number; newPos: number }[] = [];
    order.forEach((oldIndex, newPos) => {
      if (Number.isInteger(oldIndex) && oldIndex !== newPos) moves.push({ oldIndex, newPos });
    });
    for (const { oldIndex, newPos } of moves) {
      const { error } = await admin
        .from("module_state")
        .update({ module_index: newPos + OFFSET })
        .eq("space_id", params.id)
        .eq("module_index", oldIndex);
      if (error) console.error("[widgets] reorder phase1 failed:", error.message);
    }
    for (const { newPos } of moves) {
      const { error } = await admin
        .from("module_state")
        .update({ module_index: newPos })
        .eq("space_id", params.id)
        .eq("module_index", newPos + OFFSET);
      if (error) console.error("[widgets] reorder phase2 failed:", error.message);
    }
  }

  return NextResponse.json({ ok: true, modulesRev: (expectedRev ?? 0) + 1 });
}

export async function DELETE(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  const parsed = await parseBody(req, z.object({
    index: z.number().optional(),
    modulesRev: z.number().int().nonnegative().optional(),
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const idx = typeof body.index === "number" ? Math.floor(body.index) : -1;
  if (idx < 0 || idx > 64) return NextResponse.json({ error: "bad_index" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await fetchWidgetSpace(admin, params.id);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const current = Array.isArray(space.modules) ? space.modules : [];
  if (idx >= current.length) return NextResponse.json({ error: "out_of_range" }, { status: 400 });

  const next = current.filter((_, i) => i !== idx);
  const expectedRev = typeof body.modulesRev === "number"
    ? body.modulesRev
    : readModulesRev(space);
  const failure = await persistModules(admin, params.id, next, expectedRev);
  if (failure) return failure;

  // Drop the deleted module's collaborative rows. State is associated by the
  // stable module_id now, so we delete by id when the module has one — that
  // hits exactly this widget's rows regardless of index drift. The
  // module_index shift below is kept only to keep the legacy positional key
  // tidy for the index-based write-path; it is no longer load-bearing for
  // correctness (reads associate by id).
  const deletedModuleId = (current[idx] as { id?: unknown } | undefined)?.id;
  const delBase = admin.from("module_state").delete().eq("space_id", params.id);
  const { error: delErr } = typeof deletedModuleId === "string"
    ? await delBase.eq("module_id", deletedModuleId)
    : await delBase.eq("module_index", idx);
  if (delErr) console.error("[widgets] state cleanup failed:", delErr.message);
  for (let k = idx + 1; k < current.length; k++) {
    const { error: shiftErr } = await admin
      .from("module_state")
      .update({ module_index: k - 1 })
      .eq("space_id", params.id)
      .eq("module_index", k);
    if (shiftErr) console.error("[widgets] state reindex failed at", k, shiftErr.message);
  }

  return NextResponse.json({ ok: true, modulesRev: (expectedRev ?? 0) + 1 });
}
