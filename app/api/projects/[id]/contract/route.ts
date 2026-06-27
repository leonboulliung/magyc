import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { mapHandoff } from "@/lib/db";
import { parseBody } from "@/lib/api/validate";
import { getProjectAccess } from "@/lib/server/projectAccess";

/**
 * GET/PUT /api/projects/[id]/contract — the Absegnung contract record.
 *
 * GET  — owner always; a non-owner only when the space is shared (the client
 *        with the link). Returns the contract row or null.
 * PUT  — owner only. Freezes the reviewed draft into the contract (status
 *        "sent", ready for signatures). Rejected once the contract is locked.
 */

function contentHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id, shared, title, stage")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { userId } = await auth();
  const accessRole = await getProjectAccess(admin, {
    spaceId: params.id,
    ownerId: space.owner_id,
    shared: space.shared,
    userId,
  });
  const isOwner = accessRole === "owner";
  if (accessRole === "none") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: contract } = await admin
    .from("project_contracts")
    .select("*")
    .eq("space_id", params.id)
    .maybeSingle();

  // handoff column (migration 016) read tolerantly so a pre-migration deploy
  // doesn't break the contract page.
  let handoff = { note: "", links: [] as { label: string; url: string }[] };
  try {
    const { data: h, error } = await admin.from("spaces").select("handoff").eq("id", params.id).maybeSingle();
    if (!error && h) handoff = mapHandoff((h as { handoff?: unknown }).handoff);
  } catch { /* column not present yet */ }

  return NextResponse.json({
    contract: contract ?? null,
    isOwner,
    accessRole,
    canSign: accessRole === "owner" || accessRole === "client" || accessRole === "link",
    spaceTitle: space.title,
    stage: space.stage ?? null,
    handoff,
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = await parseBody(req, z.object({
    parties: z.unknown(),
    clauses: z.array(z.unknown()).max(20),
    conditionsSnapshot: z.unknown().optional(),
    draftMeta: z.unknown().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Don't overwrite a signed/locked contract.
  const { data: existing } = await admin
    .from("project_contracts")
    .select("locked")
    .eq("space_id", params.id)
    .maybeSingle();
  if (existing?.locked) return NextResponse.json({ error: "locked" }, { status: 409 });

  const hash = contentHash({ parties: body.parties, clauses: body.clauses });
  const { error } = await admin.from("project_contracts").upsert(
    {
      space_id: params.id,
      parties: body.parties ?? {},
      clauses: body.clauses ?? [],
      conditions_snapshot: body.conditionsSnapshot ?? {},
      draft_meta: body.draftMeta ?? null,
      status: "sent",
      content_hash: hash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "space_id" },
  );
  if (error) {
    console.error("[contract] save failed:", error.message);
    return NextResponse.json({ error: "save_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
