import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { parseBody } from "@/lib/api/validate";

/**
 * PATCH /api/projects/[id] — update a Creator-Suite project's lifecycle
 * stage. Owner-only (the Clerk owner bound at creation). Stage-specific
 * workspace behaviour is layered on in later phases; for now this just
 * persists the position.
 */
const VALID_STAGES = new Set(["brief", "production", "handoff"]);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({ stage: z.string().optional() }));
  if (!parsed.ok) return parsed.response;
  const stage = typeof parsed.data.stage === "string" ? parsed.data.stage : "";
  if (!VALID_STAGES.has(stage)) {
    return NextResponse.json({ error: "bad_stage" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("spaces").update({ stage }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/projects/[id] — permanently delete a suite project. Owner-only.
 * module_state rows cascade (FK on delete cascade in 001).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("spaces").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
