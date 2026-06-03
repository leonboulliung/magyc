import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/** DELETE — unblock a previously-blocked user. */
export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
