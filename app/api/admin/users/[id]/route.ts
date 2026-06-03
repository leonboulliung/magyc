import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/server/admin";

/**
 * PATCH — set or clear the `banned` flag on a profile. Banning is the
 * only admin write supported here. Anything heavier (delete cards,
 * impersonate, …) stays out of this surface on purpose.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (params.id === userId) {
    return NextResponse.json({ error: "self_ban" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { banned?: boolean };
  if (typeof body.banned !== "boolean") {
    return NextResponse.json({ error: "missing_banned" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ banned: body.banned })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
