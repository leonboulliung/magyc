/**
 * Admin gating — comma-separated Clerk user IDs in the env var
 * `ADMIN_USER_IDS`. Anything else is non-admin. Lives under lib/server/
 * because the env var must never leak to a client bundle.
 *
 * Setup: visit /admin while signed in; if you're not on the list yet,
 * the page renders your own Clerk userId so you can paste it into
 * ADMIN_USER_IDS (.env.local for local, Vercel project env for prod).
 */
function parseAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return parseAdminIds().has(userId);
}
