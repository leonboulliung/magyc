import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/projects/[id]/contract/release — owner releases the prepared
 * contract for signing. Until released the client only sees a "wird
 * vorbereitet" page (see docs/CONTRACT_PHASE.md); afterwards both parties can
 * sign. Owner-only; refused once the contract is locked.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
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

  const { data: contract } = await admin
    .from("project_contracts")
    .select("status, locked")
    .eq("space_id", params.id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "no_contract" }, { status: 409 });
  if (contract.locked) return NextResponse.json({ error: "locked" }, { status: 409 });

  const { error } = await admin
    .from("project_contracts")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("space_id", params.id);
  if (error) {
    console.error("[contract-release] failed:", error.message);
    return NextResponse.json({ error: "release_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
