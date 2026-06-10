import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeStyle } from "@/lib/style";

/**
 * PUT /api/spaces/[id]/style
 *   Body: { style: SpaceStyle, anonOwnerToken?: string }
 *
 * Replace the space's visual style. Owner-only (anon token on drafts,
 * Clerk session on published). The style does NOT create a version
 * snapshot — it's presentation, not content.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: { style?: unknown; anonOwnerToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const style = sanitizeStyle(body.style);
  if (!style) return NextResponse.json({ error: "style_invalid" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { userId } = await auth();
  if (space.visibility === null) {
    const tok = typeof body.anonOwnerToken === "string" ? body.anonOwnerToken.trim() : "";
    if (tok.length < 16 || tok !== space.anon_owner_token) {
      return NextResponse.json({ error: "owner_token_mismatch" }, { status: 403 });
    }
  } else if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await admin.from("spaces").update({ style }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
