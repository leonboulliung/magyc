import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Ensure a `profiles` row exists for a Clerk user. Idempotent. Snapshots
 * a display name and avatar from Clerk so we don't have to hit them on
 * every read.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return;

  let displayName = "";
  let avatarUrl: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    displayName =
      user.username ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses[0]?.emailAddress.split("@")[0] ||
      `user-${userId.slice(-6)}`;
    avatarUrl = user.imageUrl || null;
  } catch {
    displayName = `user-${userId.slice(-6)}`;
  }

  await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
    },
    { onConflict: "id" },
  );
}
