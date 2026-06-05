import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Ensure a profiles row exists for the given Clerk userId. The
 * profiles table is the foreign-key bridge for everything that
 * references a user. Idempotent — safe to call on every write.
 *
 * Pulls a display name + avatar from Clerk on first creation. We
 * intentionally don't store more than this: anything richer (bio,
 * socials, etc.) belongs to a separate decision once the new app's
 * shape is settled.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const admin = supabaseAdmin();

  // Cheap exists-check first.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return;

  // Pull a display name + avatar from Clerk.
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
