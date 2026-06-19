import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { parseBody } from "@/lib/api/validate";

/**
 * PATCH /api/projects/[id] — update a Creator-Suite project's lifecycle,
 * sharing, archive, or soft-delete state. Owner-only (the Clerk owner
 * bound at creation).
 */
const VALID_STAGES = new Set(["brief", "production", "handoff"]);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    stage: z.string().optional(),
    shared: z.boolean().optional(),
    archived: z.boolean().optional(),
    deleted: z.boolean().optional(),
  }));
  if (!parsed.ok) return parsed.response;

  const update: {
    stage?: string;
    shared?: boolean;
    archived_at?: string | null;
    deleted_at?: string | null;
    modules?: unknown[];
  } = {};
  if (typeof parsed.data.stage === "string") {
    if (!VALID_STAGES.has(parsed.data.stage)) {
      return NextResponse.json({ error: "bad_stage" }, { status: 400 });
    }
    update.stage = parsed.data.stage;
  }
  if (typeof parsed.data.shared === "boolean") {
    update.shared = parsed.data.shared;
  }
  if (typeof parsed.data.archived === "boolean") {
    update.archived_at = parsed.data.archived ? new Date().toISOString() : null;
    if (parsed.data.archived) update.deleted_at = null;
  }
  if (typeof parsed.data.deleted === "boolean") {
    update.deleted_at = parsed.data.deleted ? new Date().toISOString() : null;
    if (parsed.data.deleted) update.archived_at = null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id, modules")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Note: the "Auswahl" stage no longer auto-seeds a selection/proofing
  // widget. Per the product direction we focus on collaborative exploration
  // + structuring, not image selection / result galleries.

  const { data: updated, error } = await admin
    .from("spaces")
    .update(update)
    .eq("id", params.id)
    .select("id");
  if (error) {
    console.error("[projects] update failed:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    console.error("[projects] update matched no rows:", params.id);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/projects/[id] — soft-delete a suite project. Owner-only.
 * The Studio keeps it visible in the deleted area for recovery.
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

  const { data: updated, error } = await admin
    .from("spaces")
    .update({ deleted_at: new Date().toISOString(), archived_at: null })
    .eq("id", params.id)
    .select("id");
  if (error) {
    console.error("[projects] delete failed:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    console.error("[projects] delete matched no rows:", params.id);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
