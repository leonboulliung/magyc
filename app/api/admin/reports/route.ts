import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/server/admin";

/**
 * GET — list reports. By default, only unresolved ones (the queue);
 * pass `?all=1` to see history too. Joins the reporter profile, the
 * target card (with its owner), and the target profile, so the admin
 * UI never has to round-trip per row.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const showAll = url.searchParams.get("all") === "1";

  const admin = supabaseAdmin();
  let query = admin
    .from("reports")
    .select(`
      id, reason, detail, resolved, resolved_at, created_at, target_kind,
      target_card_id, target_profile_id,
      reporter:profiles!reports_reporter_id_fkey(id, display_name, avatar_url),
      target_card:cards!reports_target_card_id_fkey(
        id, title,
        owner:profiles!cards_owner_id_fkey(id, display_name, banned)
      ),
      target_profile:profiles!reports_target_profile_id_fkey(id, display_name, banned)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!showAll) query = query.eq("resolved", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data || [] });
}
