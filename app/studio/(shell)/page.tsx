import { auth } from "@clerk/nextjs/server";
import { fetchSpaceListByOwner } from "@/lib/db";
import { ensureProfile } from "@/lib/server/profile";
import { StudioHome, type StudioProjectCard } from "@/components/studio/StudioHome";

// Projects are mutable; never serve a stale dashboard from the data cache.
export const dynamic = "force-dynamic";

/**
 * Studio home — prompt-first. The create field is the centre; active projects
 * render below as mood-gradient cards. (New account-area UI.)
 */
export default async function StudioDashboard() {
  const { userId } = await auth();
  if (!userId) return null; // middleware guards this; defensive.

  await ensureProfile(userId);
  const all = (await fetchSpaceListByOwner(userId).catch(() => [])).filter((s) => s.stage !== null);
  const now = Date.now();
  const card = (p: (typeof all)[number]): StudioProjectCard =>
    ({ id: p.id, title: p.title, stage: p.stage, createdAt: p.createdAt, shared: !!p.shared });

  const projects = all.filter((p) => !p.deletedAt && !p.archivedAt).map(card);
  const archived = all.filter((p) => p.archivedAt && !p.deletedAt).map(card);
  const deleted = all.filter((p) => p.deletedAt && now - p.deletedAt <= 30 * 86_400_000).map(card);

  return <StudioHome projects={projects} archived={archived} deleted={deleted} />;
}
