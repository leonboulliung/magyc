import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/server/admin";

/**
 * PATCH — resolve or reopen a report. Body: { resolved: true|false }.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { resolved?: boolean };
  if (typeof body.resolved !== "boolean") {
    return NextResponse.json({ error: "missing_resolved" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("reports")
    .update({
      resolved: body.resolved,
      resolved_at: body.resolved ? new Date().toISOString() : null,
    })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
