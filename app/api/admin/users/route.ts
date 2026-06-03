import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/server/admin";

/**
 * GET — list profiles for the admin user table. Supports a simple search
 * (substring on display_name or id, case-insensitive) and is hard-capped
 * at 200 rows so a forgotten filter doesn't pull the whole table.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  const admin = supabaseAdmin();
  let query = admin
    .from("profiles")
    .select("id, display_name, avatar_url, banned, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    // Match the id OR the display name (case-insensitive substring).
    const safe = q.replace(/[%_]/g, "\\$&");
    query = query.or(`display_name.ilike.%${safe}%,id.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}
