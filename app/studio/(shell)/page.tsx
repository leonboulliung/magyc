import { auth } from "@clerk/nextjs/server";
import { fetchSpaceListByOwnerWithClient } from "@/lib/db";
import { ensureProfile } from "@/lib/server/profile";
import { claimPendingProjectMemberships } from "@/lib/server/projectAccess";
import { fetchStudioProjectSummaries } from "@/lib/server/studioDashboard";
import { supabaseAdmin } from "@/lib/supabase";
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
  const admin = supabaseAdmin();
  await claimPendingProjectMemberships(admin, userId);
  let all;
  try {
    all = (await fetchStudioProjectSummaries(admin, userId)).filter((space) => space.stage !== null);
  } catch {
    const fallback = (await fetchSpaceListByOwnerWithClient(admin, userId).catch(() => []))
      .filter((space) => space.stage !== null);
    all = fallback.map((space) => ({
      ...space,
      lastActivityAt: space.createdAt,
      stateCount: 0,
      uploadCount: 0,
      memberCount: 0,
      accessRole: "owner" as const,
    }));
  }
  const now = Date.now();
  const card = (p: (typeof all)[number]): StudioProjectCard =>
    ({
      id: p.id,
      title: p.title,
      stage: p.stage,
      createdAt: p.createdAt,
      lastActivityAt: p.lastActivityAt,
      shared: !!p.shared,
      stateCount: p.stateCount,
      uploadCount: p.uploadCount,
      memberCount: p.memberCount,
      accessRole: p.accessRole,
    });

  const projects = all.filter((p) => !p.deletedAt && !p.archivedAt).map(card);
  const archived = all.filter((p) => p.archivedAt && !p.deletedAt).map(card);
  const deleted = all.filter((p) => p.deletedAt && now - p.deletedAt <= 30 * 86_400_000).map(card);

  return <StudioHome projects={projects} archived={archived} deleted={deleted} />;
}
