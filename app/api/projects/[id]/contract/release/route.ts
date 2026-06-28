import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validate";
import { contractContentHash } from "@/lib/server/projectContract";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/projects/[id]/contract/release — owner releases the prepared
 * contract for signing. Until released the client only sees a "wird
 * vorbereitet" page (see docs/CONTRACT_PHASE.md); afterwards both parties can
 * sign. Owner-only; refused once the contract is locked.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, z.object({
    parties: z.unknown(),
    clauses: z.array(z.unknown()).max(20),
    draftMeta: z.unknown().optional(),
    signatureMode: z.enum(["click", "draw"]),
  }));
  if (!parsed.ok) return parsed.response;

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: contract } = await admin
    .from("project_contracts")
    .select("status, locked, audit")
    .eq("space_id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "no_contract" }, { status: 409 });
  if (contract.locked) return NextResponse.json({ error: "locked" }, { status: 409 });
  if (contract.status !== "draft" && contract.status !== "sent") {
    return NextResponse.json({ error: "contract_already_released" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const audit = Array.isArray(contract.audit) ? [...contract.audit] : [];
  audit.push({ event: "released", signatureMode: parsed.data.signatureMode, ts: now });
  const { data: released, error } = await admin
    .from("project_contracts")
    .update({
      parties: parsed.data.parties,
      clauses: parsed.data.clauses,
      draft_meta: parsed.data.draftMeta ?? null,
      mode: parsed.data.signatureMode,
      content_hash: contractContentHash({ parties: parsed.data.parties, clauses: parsed.data.clauses }),
      status: "released",
      audit,
      updated_at: now,
    })
    .eq("space_id", id)
    .in("status", ["draft", "sent"])
    .select("space_id");
  if (error) {
    console.error("[contract-release] failed:", error.message);
    return NextResponse.json({ error: "release_failed", detail: error.message }, { status: 500 });
  }
  if (!released?.length) return NextResponse.json({ error: "contract_already_released" }, { status: 409 });
  return NextResponse.json({ ok: true, signatureMode: parsed.data.signatureMode });
}
