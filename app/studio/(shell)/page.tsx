import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchSpacesByOwner } from "@/lib/db";
import { ensureProfile } from "@/lib/server/profile";
import type { ProjectStage } from "@/lib/types";

// Projects are mutable; never serve a stale dashboard from the data cache.
export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<ProjectStage, string> = {
  brief: "Briefing",
  production: "Produktion",
  handoff: "Übergabe",
};

function relTime(ts: number): string {
  const d = Math.max(0, Date.now() - ts);
  const day = 86_400_000;
  if (d < day) return "heute";
  const days = Math.floor(d / day);
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  return months === 1 ? "vor 1 Monat" : `vor ${months} Monaten`;
}

export default async function StudioDashboard() {
  const { userId } = await auth();
  if (!userId) return null; // middleware guards this; defensive.

  await ensureProfile(userId);
  const projects = (await fetchSpacesByOwner(userId).catch(() => [])).filter(
    // Only real suite projects (have a stage); legacy published spaces
    // owned by this user without a stage are not shown as projects.
    (s) => s.stage !== null,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio</p>
          <h1 className="mt-3 font-brand text-[30px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            Deine Projekte
          </h1>
        </div>
        <Link
          href="/studio/new"
          className="shrink-0 rounded-full bg-white px-5 py-2.5 font-body text-sm font-medium text-black transition-all hover:bg-white/85 active:scale-[0.98]"
        >
          Neues Projekt
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 p-10 text-center">
          <p className="font-brand text-[20px] font-bold text-white">Noch kein Projekt</p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/60">
            Starte mit einem geführten Produkt-Briefing — Referenzen, Shotlist, Deliverables
            und Freigaben sind in Minuten aufgesetzt.
          </p>
          <Link
            href="/studio/new"
            className="mt-7 inline-block rounded-full bg-white px-5 py-2.5 font-body text-sm font-medium text-black transition-all hover:bg-white/85"
          >
            Erstes Projekt anlegen
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/studio/${p.id}`}
              className="group flex flex-col rounded-2xl border border-white/12 bg-white/[0.02] p-5 transition-colors hover:border-white/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2">
                <span className="mono rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
                  {p.stage ? STAGE_LABEL[p.stage] : "—"}
                </span>
                {p.segment && (
                  <span className="mono text-[10px] uppercase tracking-widest text-white/35">{p.segment}</span>
                )}
              </div>
              <h2 className="mt-4 line-clamp-2 font-body text-[17px] font-medium leading-snug text-white">
                {p.title || "Unbenanntes Projekt"}
              </h2>
              <span className="mono mt-auto pt-5 text-[11px] tracking-widest text-white/35">
                {relTime(p.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
