import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeStyle } from "@/lib/style";
import { parseBody } from "@/lib/api/validate";
import { isSpaceOwner, forbidden } from "@/lib/api/auth";

/**
 * PUT /api/spaces/[id]/style
 *   Body: { style: SpaceStyle, anonOwnerToken?: string }
 *
 * Replace the space's visual style. Owner-only (anon token on drafts,
 * Clerk owner account on published). The style does NOT create a
 * version snapshot — it's presentation, not content.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = await parseBody(req, z.object({
    style: z.unknown().optional(),
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const style = sanitizeStyle(body.style);
  if (!style) return NextResponse.json({ error: "style_invalid" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  // The .select() is load-bearing: without it Supabase reports success
  // even when 0 rows matched (silent no-op writes).
  const { data: updated, error } = await admin
    .from("spaces")
    .update({ style })
    .eq("id", params.id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "update_no_match" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
