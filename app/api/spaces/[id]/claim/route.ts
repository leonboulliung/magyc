import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { parseBody } from "@/lib/api/validate";

/**
 * POST /api/spaces/[id]/claim — move an anonymous homepage draft into the
 * signed-in user's private Studio. This is intentionally NOT publish:
 * visibility stays null, the project gets a stage, and the owner lands in
 * /studio/[id] for planning.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    anonOwnerToken: z.string().nullish(),
  }));
  if (!parsed.ok) return parsed.response;
  const anonToken = typeof parsed.data.anonOwnerToken === "string"
    ? parsed.data.anonOwnerToken.trim()
    : "";
  if (anonToken.length < 16) {
    return NextResponse.json({ error: "owner_token_required" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: space, error: fetchErr } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, stage")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (space.owner_id && space.owner_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!space.owner_id && space.anon_owner_token !== anonToken) {
    return NextResponse.json({ error: "owner_token_mismatch" }, { status: 403 });
  }
  if (space.visibility) {
    return NextResponse.json({ error: "already_published" }, { status: 409 });
  }

  await ensureProfile(userId);

  if (!space.owner_id || !space.stage) {
    const { error: upErr } = await admin
      .from("spaces")
      .update({
        owner_id: userId,
        visibility: null,
        stage: space.stage || "brief",
        segment: "product",
        shared: false,
      })
      .eq("id", params.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: params.id, redirectTo: `/studio/${params.id}` });
}
