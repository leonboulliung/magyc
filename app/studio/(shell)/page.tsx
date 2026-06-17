import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchSpacesByOwner } from "@/lib/db";
import { ensureProfile } from "@/lib/server/profile";
import { ProjectCardActions } from "@/components/studio/ProjectCardActions";
import { StudioSettingsPanel } from "@/components/studio/StudioSettingsPanel";
import type { ProjectStage } from "@/lib/types";

// Projects are mutable; never serve a stale dashboard from the data cache.
export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<ProjectStage, string> = {
  brief: "Planung",
  production: "Auswahl",
  handoff: "Abgeschlossen",
};

const STAGE_HELP: Record<ProjectStage, string> = {
  brief: "Briefing, Moodboard, Shotlist, Team und Ablauf vorbereiten.",
  production: "Auswahl, Feedback, Freigaben und Übergabe vorbereiten.",
  handoff: "Fertige Projekte, Kundenseiten und Referenzen sammeln.",
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
  const counts = {
    brief: projects.filter((p) => p.stage === "brief").length,
    production: projects.filter((p) => p.stage === "production").length,
    handoff: projects.filter((p) => p.stage === "handoff").length,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio</p>
          <h1 className="mt-3 font-brand text-[30px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            Deine Projekte
          </h1>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {([
          ["brief", "Planung"],
          ["production", "Auswahl"],
          ["handoff", "Abgeschlossen"],
        ] as const).map(([key, text]) => (
          <div key={key} className="rounded-2xl border border-white/12 bg-white/[0.035] p-4">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-white/40">{text}</div>
            <div className="mt-3 font-brand text-[28px] font-bold text-white">{counts[key]}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">{STAGE_HELP[key]}</p>
          </div>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 p-10 text-center">
          <p className="font-brand text-[20px] font-bold text-white">Noch kein Projekt</p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/60">
            Starte mit einer geführten Planung — Referenzen, Shotlist, Deliverables
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
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              Projektliste
            </p>
            <Link
              href="/studio/new"
              aria-label="Neues Projekt"
              title="Neues Projekt"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-white/85 active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
          <div className="rounded-2xl border border-white/12">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/[0.04]">
              <tr className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                <th className="px-4 py-3 font-normal">Projekt</th>
                <th className="px-4 py-3 font-normal">Phase</th>
                <th className="px-4 py-3 font-normal">Typ</th>
                <th className="px-4 py-3 font-normal">Erstellt</th>
                <th className="px-4 py-3 text-right font-normal">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-white/10 text-white/78 hover:bg-white/[0.035]">
                  <td className="px-4 py-4">
                    <Link href={`/studio/${p.id}`} className="font-body text-[15px] font-medium text-white hover:underline">
                      {p.title || "Unbenanntes Projekt"}
                    </Link>
                  </td>
                  <td className="px-4 py-4 mono text-[11px] uppercase tracking-widest text-white/55">
                    {p.stage ? STAGE_LABEL[p.stage] : "—"}
                  </td>
                  <td className="px-4 py-4 mono text-[11px] uppercase tracking-widest text-white/35">
                    {p.segment ?? "—"}
                  </td>
                  <td className="px-4 py-4 mono text-[11px] tracking-widest text-white/35">
                    {relTime(p.createdAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      <ProjectCardActions id={p.id} title={p.title} shared={p.shared} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <StudioSettingsPanel />
    </div>
  );
}
