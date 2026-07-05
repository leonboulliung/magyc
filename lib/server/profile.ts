import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { colorForId } from "@/lib/palette";
import { recordAppEvent } from "@/lib/server/observability";

/** Serialise a Supabase/PostgREST error with the fields we need to diagnose. */
function pgErr(e: unknown): string {
  const x = e as { message?: string; code?: string; details?: string; hint?: string } | null;
  return [x?.code && `code=${x.code}`, x?.message, x?.details, x?.hint]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 500);
}

/** Never let a slow/hanging Clerk call stall profile creation. */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Ensure a `profiles` row exists for a Clerk user. Idempotent. Snapshots
 * a display name and avatar from Clerk so we don't have to hit them on
 * every read. On failure it records the exact DB error to `app_events`
 * (diagnostic) and rethrows so callers that need the row (claim/publish)
 * can surface a real error instead of silently violating the FK.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { data: existing, error: fetchErr } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) {
    const detail = pgErr(fetchErr);
    console.error("[profile] ensure fetch failed:", detail);
    await recordAppEvent({ eventType: "profile_ensure_error", status: "error", userId, error: `fetch: ${detail}` });
    throw new Error("profile_fetch_failed");
  }
  if (existing) return;

  // Clerk enrichment is best-effort and time-bounded — a slow Backend API
  // call must never block (or hang) profile creation.
  let displayName = `user-${userId.slice(-6)}`;
  let avatarUrl: string | null = null;
  try {
    const client = await clerkClient();
    const user = await withTimeout(client.users.getUser(userId), 4000);
    displayName =
      user.username ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses[0]?.emailAddress.split("@")[0] ||
      displayName;
    avatarUrl = user.imageUrl || null;
  } catch {
    // keep the fallback display name
  }

  // A stable accent derived from the Clerk user id, so widgets that
  // attribute by colour (Sketch strokes, Checklist marks) always have
  // something to render and each person keeps the same accent forever.
  const color = colorForId(userId);
  const row = { id: userId, display_name: displayName, avatar_url: avatarUrl, color };

  // One retry: absorbs a transient hiccup on the first write for a brand-new
  // account without masking a real, persistent error.
  let upsertErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await admin.from("profiles").upsert(row, { onConflict: "id" });
    if (!error) { upsertErr = null; break; }
    upsertErr = error;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
  }
  if (upsertErr) {
    const detail = pgErr(upsertErr);
    console.error("[profile] ensure upsert failed:", detail);
    await recordAppEvent({ eventType: "profile_ensure_error", status: "error", userId, error: `upsert: ${detail}` });
    throw new Error("profile_upsert_failed");
  }
}

export async function fetchProjectTheme(ownerId: string | null | undefined): Promise<"dark" | "light"> {
  if (!ownerId) return "light";
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.from("profiles").select("settings").eq("id", ownerId).maybeSingle();
    if (error) throw error;
    const theme = (data?.settings as { projectTheme?: unknown } | null)?.projectTheme;
    return theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
