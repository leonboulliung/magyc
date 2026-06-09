import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeModule, sanitizeModules } from "@/lib/modules";
import { newId } from "@/lib/id";

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

async function authorize(
  space: { anon_owner_token: string; owner_id: string | null; visibility: string | null },
  body: { anonOwnerToken?: unknown },
): Promise<boolean> {
  const { userId } = await auth();
  if (space.visibility === null) {
    const tok = typeof body.anonOwnerToken === "string" ? body.anonOwnerToken.trim() : "";
    return tok.length >= 16 && tok === space.anon_owner_token;
  }
  return !!userId;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: { widget?: unknown; anonOwnerToken?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const widget = sanitizeModule(body.widget);
  if (!widget) return NextResponse.json({ error: "widget_invalid" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, modules")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await authorize(space, body)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const current = Array.isArray(space.modules) ? space.modules : [];
  const next = [...current, widget];
  const newIndex = current.length;

  const { error } = await admin
    .from("spaces")
    .update({ modules: next })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, index: newIndex });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: { modules?: unknown; anonOwnerToken?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

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
  if (!await authorize(space, body)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const { error } = await admin
    .from("spaces")
    .update({ modules })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: { index?: unknown; anonOwnerToken?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const idx = typeof body.index === "number" ? Math.floor(body.index) : -1;
  if (idx < 0 || idx > 64) return NextResponse.json({ error: "bad_index" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, modules")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await authorize(space, body)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const current = Array.isArray(space.modules) ? space.modules : [];
  if (idx >= current.length) return NextResponse.json({ error: "out_of_range" }, { status: 400 });

  const next = current.filter((_, i) => i !== idx);
  const { error } = await admin
    .from("spaces")
    .update({ modules: next })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
