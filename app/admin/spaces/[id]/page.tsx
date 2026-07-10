import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchHandoffWithClient, fetchSpaceByIdWithClient } from "@/lib/db";
import { ProjectFactsSummary } from "@/components/projects/ProjectFactsSummary";
import { AiTraceTimeline, type AiTraceEvent } from "@/components/admin/AiTraceTimeline";
import { buildProjectFacts } from "@/lib/projectFacts";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { de } from "@/lib/i18n/dictionaries/de";

export const dynamic = "force-dynamic";

export default async function AdminSpaceInspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (!gate.ok) notFound();

  const admin = supabaseAdmin();
  const space = await fetchSpaceByIdWithClient(admin, id).catch(() => null);
  if (!space) notFound();
  space.handoff = await fetchHandoffWithClient(admin, space.id);
  const facts = buildProjectFacts(space.modules, space.state, space.language);

  // Provenance: the AI/data-flow events recorded across this project's life.
  // Strictly read-only — no interactive SpaceView (that "ghost" view let an
  // admin mutate content and join as a member).
  let events: AiTraceEvent[] = [];
  try {
    const { data } = await admin
      .from("ai_events")
      .select("id, event_type, model, status, input, output, metadata, latency_ms, tokens_in, tokens_out, created_at, user_id, anon_id")
      .eq("space_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    events = (data ?? []) as AiTraceEvent[];
  } catch { /* table missing → empty trace */ }

  return (
    <main className="min-h-screen bg-[#f4f4f1] pb-16">
      <div className="sticky top-0 z-50 border-b border-black/10 bg-[#f4f4f1]/90 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.28em] text-black/45">Admin · Nachvollziehbarkeit (read-only)</p>
            <h1 className="mt-1 truncate text-lg font-semibold text-[#17171a]">{space.title || space.id}</h1>
          </div>
          <Link href="/admin" className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#17171a]">
            Zurück
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-8 px-5 pt-6">
        <ProjectFactsSummary facts={facts} title={de.projectFacts.structuredData} />
        <section>
          <h2 className="mono mb-3 text-[11px] uppercase tracking-[0.22em] text-black/45">
            KI- & Daten-Verlauf <span className="text-black/30">({events.length})</span>
          </h2>
          <AiTraceTimeline events={events} />
        </section>
      </div>
    </main>
  );
}
