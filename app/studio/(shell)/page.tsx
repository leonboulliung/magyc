import { auth } from "@clerk/nextjs/server";
import { fetchSpaceListByOwnerWithClient } from "@/lib/db";
import { ensureProfile } from "@/lib/server/profile";
import { fetchStudioProjectSummaries } from "@/lib/server/studioDashboard";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
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

  try {
    await ensureProfile(userId);
  } catch (error) {
    console.error("[studio] profile initialization failed", error);
    return <StudioDataUnavailable />;
  }
  const admin = supabaseAdmin();
  let all;
  try {
    all = (await fetchStudioProjectSummaries(admin, userId)).filter((space) => space.stage !== null);
  } catch (summaryError) {
    try {
      const fallback = (await fetchSpaceListByOwnerWithClient(admin, userId))
        .filter((space) => space.stage !== null);
      all = fallback.map((space) => ({
        ...space,
        lastActivityAt: space.createdAt,
        stateCount: 0,
        uploadCount: 0,
        memberCount: 0,
        accessRole: "owner" as const,
      }));
    } catch (fallbackError) {
      console.error("[studio] project data unavailable", { summaryError, fallbackError });
      return <StudioDataUnavailable />;
    }
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

function StudioDataUnavailable() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-4 py-16 sm:px-8">
      <div className="max-w-xl">
        <p className="mono text-[10px] uppercase tracking-[0.2em] opacity-45">Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Deine Projekte konnten gerade nicht geladen werden.</h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed opacity-60">
          Deine Daten bleiben erhalten. Bitte lade die Seite in einem Moment erneut.
        </p>
        <a
          href="/studio"
          className="mt-7 inline-flex min-h-10 items-center rounded-full border border-current/20 px-5 text-sm font-medium transition-opacity hover:opacity-65"
        >
          Erneut laden
        </a>
      </div>
    </main>
  );
}
