import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// TEMPORARY diagnostic: surfaces the exact DB error that blocks profile
// creation for a signed-in account. Read-only and scoped to the caller's own
// profile row (no data leak). Remove once the new-account failure is fixed.
export const dynamic = "force-dynamic";

function ser(e: unknown) {
  if (!e) return null;
  const x = e as { message?: string; code?: string; details?: string; hint?: string };
  return { code: x.code ?? null, message: x.message ?? null, details: x.details ?? null, hint: x.hint ?? null };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const out: Record<string, unknown> = { userId };

  const fetchRes = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  out.fetch = { error: ser(fetchRes.error), exists: !!fetchRes.data };

  const upsertRes = await admin.from("profiles").upsert(
    { id: userId, display_name: `user-${userId.slice(-6)}`, avatar_url: null, color: "#7da3c0" },
    { onConflict: "id" },
  );
  out.upsert = { error: ser(upsertRes.error) };

  return NextResponse.json(out);
}
