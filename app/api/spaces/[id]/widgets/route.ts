import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeModule, sanitizeModules } from "@/lib/modules";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import { isSpaceOwner, forbidden } from "@/lib/api/auth";

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

/** Write the modules array. The .select() is load-bearing: without it
 *  Supabase reports success even when 0 rows matched. Returns an error
 *  response, or null on success. */
async function persistModules(
  admin: ReturnType<typeof supabaseAdmin>,
  spaceId: string,
  modules: unknown[],
): Promise<NextResponse | null> {
  const { data, error } = await admin
    .from("spaces")
    .update({ modules })
    .eq("id", spaceId)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "update_no_match" }, { status: 500 });
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = await parseBody(req, z.object({
    widget: z.unknown().optional(),
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const widget = sanitizeModule(body.widget);
  if (!widget) return NextResponse.json({ error: "widget_invalid" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, modules")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const current = Array.isArray(space.modules) ? space.modules : [];
  const next = [...current, widget];
  const newIndex = current.length;

  const failure = await persistModules(admin, params.id, next);
  if (failure) return failure;

  return NextResponse.json({ ok: true, index: newIndex });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = await parseBody(req, z.object({
    modules: z.unknown().optional(),
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!Array.isArray(body.modules)) {
    return NextResponse.json({ error: "modules_required" }, { status: 400 });
  }
  const modules = sanitizeModules(body.modules);

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const failure = await persistModules(admin, params.id, modules);
  if (failure) return failure;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = await parseBody(req, z.object({
    index: z.number().optional(),
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const idx = typeof body.index === "number" ? Math.floor(body.index) : -1;
  if (idx < 0 || idx > 64) return NextResponse.json({ error: "bad_index" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, modules")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const current = Array.isArray(space.modules) ? space.modules : [];
  if (idx >= current.length) return NextResponse.json({ error: "out_of_range" }, { status: 400 });

  const next = current.filter((_, i) => i !== idx);
  const failure = await persistModules(admin, params.id, next);
  if (failure) return failure;

  return NextResponse.json({ ok: true });
}
