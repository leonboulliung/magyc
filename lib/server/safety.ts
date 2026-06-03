import { supabaseAdmin } from "@/lib/supabase";

/**
 * Server-side check: is this Clerk user banned? Hits the DB; caller
 * decides whether to short-circuit the request. Returns false when no
 * profile row exists (the user hasn't onboarded yet — that's a separate
 * problem, not a safety one).
 */
export async function isBanned(userId: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("banned")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.banned;
}
