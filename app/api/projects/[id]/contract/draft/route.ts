import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureProjectContractDraft } from "@/lib/server/projectContract";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

/** Regenerate the owner's editable draft. Normal phase activation uses the
 * same service with force=false and therefore never duplicates AI work. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data: space } = await admin.from("spaces").select("owner_id").eq("id", id).maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const result = await ensureProjectContractDraft({ admin, spaceId: id, force: true });
    return NextResponse.json({ draft: result.draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "draft_failed";
    console.error("[contract-draft] failed:", message);
    const status = message === "contract_already_released" ? 409 : message === "rate_limited" ? 429 : 502;
    return NextResponse.json({ error: message.split(":")[0] || "draft_failed" }, { status });
  }
}
