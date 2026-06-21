import { auth } from "@clerk/nextjs/server";
import { fetchSpacesByOwner } from "@/lib/db";
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
  const all = (await fetchSpacesByOwner(userId).catch(() => [])).filter((s) => s.stage !== null);
  const projects: StudioProjectCard[] = all
    .filter((p) => !p.deletedAt && !p.archivedAt)
    .map((p) => ({ id: p.id, title: p.title, stage: p.stage, createdAt: p.createdAt, shared: !!p.shared }));

  return <StudioHome projects={projects} />;
}
