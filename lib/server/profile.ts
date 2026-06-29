import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { colorForId } from "@/lib/palette";

/**
 * Ensure a `profiles` row exists for a Clerk user. Idempotent. Snapshots
 * a display name and avatar from Clerk so we don't have to hit them on
 * every read.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { data: existing, error: fetchErr } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) {
    console.error("[profile] ensure fetch failed:", fetchErr.message);
    throw new Error("profile_fetch_failed");
  }
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

  // A stable accent derived from the Clerk user id, so widgets that
  // attribute by colour (Sketch strokes, Checklist marks) always have
  // something to render and each person keeps the same accent forever.
  const color = colorForId(userId);

  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      color,
    },
    { onConflict: "id" },
  );
  if (upsertErr) {
    console.error("[profile] ensure upsert failed:", upsertErr.message);
    throw new Error("profile_upsert_failed");
  }
}

/**
 * The project-page canvas theme chosen by a project's OWNER (account setting),
 * applied for both the owner and the clients viewing the shared link so a
 * project looks consistent. Tolerant: any failure → "dark" (the default).
 */
export async function fetchProjectTheme(ownerId: string | null | undefined): Promise<"dark" | "light"> {
  if (!ownerId) return "dark";
  try {
    const admin = supabaseAdmin();
    const { data } = await admin.from("profiles").select("settings").eq("id", ownerId).maybeSingle();
    const theme = (data?.settings as { projectTheme?: unknown } | null)?.projectTheme;
    return theme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
