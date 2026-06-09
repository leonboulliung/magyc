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

  // Pick a color from a small curated palette so widgets that
  // attribute by color (Sketch strokes, Checklist marks) have
  // something to render. Derived from the Clerk user id so each
  // person keeps the same accent forever.
  const palette = ["#7da3c0", "#d4a373", "#a3c08e", "#c0857d", "#8d8dc0", "#c0bd7d"];
  let bucket = 0;
  for (let i = 0; i < userId.length; i++) bucket = (bucket + userId.charCodeAt(i)) % palette.length;
  const color = palette[bucket];

  await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      color,
    },
    { onConflict: "id" },
  );
}
