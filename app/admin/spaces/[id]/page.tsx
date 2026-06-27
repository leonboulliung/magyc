import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchHandoffWithClient, fetchSpaceByIdWithClient } from "@/lib/db";
import { SpaceView } from "@/app/s/[id]/SpaceView";
import { ProjectFactsSummary } from "@/components/projects/ProjectFactsSummary";
import { buildProjectFacts } from "@/lib/projectFacts";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminSpaceInspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (!gate.ok) notFound();

  const admin = supabaseAdmin();
  const space = await fetchSpaceByIdWithClient(admin, id).catch(() => null);
  if (!space) notFound();
  space.handoff = await fetchHandoffWithClient(admin, space.id);
  const facts = buildProjectFacts(space.modules, space.state);

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <div className="sticky top-0 z-50 border-b border-black/10 bg-[#f4f4f1]/90 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.28em] text-black/45">Admin · Read-only Projekt</p>
            <h1 className="mt-1 truncate text-lg font-semibold text-[#17171a]">{space.title || space.id}</h1>
          </div>
          <Link href="/admin" className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#17171a]">
            Zurück
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 pt-5">
        <ProjectFactsSummary facts={facts} title="Strukturierte Projektdaten" />
      </div>
      <SpaceView id={space.id} initialSpace={space} hideLockedNotice disableRealtime />
    </main>
  );
}
