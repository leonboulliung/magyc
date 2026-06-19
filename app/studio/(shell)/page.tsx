import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchSpacesByOwner } from "@/lib/db";
import { ensureProfile } from "@/lib/server/profile";
import { ProjectCardActions } from "@/components/studio/ProjectCardActions";
import {
  StudioItemMotion,
  StudioPageMotion,
  StudioTableBodyMotion,
  StudioTableRowMotion,
} from "@/components/studio/StudioMotion";
import type { ProjectStage } from "@/lib/types";

// Projects are mutable; never serve a stale dashboard from the data cache.
export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<ProjectStage, string> = {
  brief: "Planung",
  production: "Auswahl",
  handoff: "Abgeschlossen",
};

const STAGE_HELP: Record<ProjectStage, string> = {
  brief: "Moodboard, Shotlist, Team, Orte und Ablauf vorbereiten.",
  production: "Medien auswählen, Feedback sammeln und Freigaben klären.",
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

const DELETED_RETENTION_MS = 30 * 86_400_000;

export default async function StudioDashboard() {
  const { userId } = await auth();
  if (!userId) return null; // middleware guards this; defensive.

  await ensureProfile(userId);
  const allProjects = (await fetchSpacesByOwner(userId).catch(() => [])).filter(
    // Only real suite projects (have a stage); legacy published spaces
    // owned by this user without a stage are not shown as projects.
    (s) => s.stage !== null,
  );
  const now = Date.now();
  const projects = allProjects.filter((p) => !p.deletedAt && !p.archivedAt);
  const archivedProjects = allProjects.filter((p) => p.archivedAt && !p.deletedAt);
  const deletedProjects = allProjects.filter((p) => (
    p.deletedAt && now - p.deletedAt <= DELETED_RETENTION_MS
  ));
  const counts = {
    brief: projects.filter((p) => p.stage === "brief").length,
    production: projects.filter((p) => p.stage === "production").length,
    handoff: projects.filter((p) => p.stage === "handoff").length,
  };

  return (
    <StudioPageMotion className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <StudioItemMotion className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio</p>
          <h1 className="mt-3 font-brand text-[30px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            Deine Projekte
          </h1>
        </div>
      </StudioItemMotion>

      <StudioItemMotion className="mt-7 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.025] divide-x divide-white/10">
        {([
          ["brief", "Planung"],
          ["production", "Auswahl"],
          ["handoff", "Abgeschlossen"],
        ] as const).map(([key, text]) => (
          <div key={key} className="px-4 py-3.5 sm:px-5" title={STAGE_HELP[key]}>
            <span className="font-brand text-[22px] font-bold leading-none text-white sm:text-[26px]">{counts[key]}</span>
            <span className="mono mt-2 block text-[10px] uppercase tracking-[0.18em] text-white/45">{text}</span>
          </div>
        ))}
      </StudioItemMotion>

      {projects.length === 0 ? (
        <StudioItemMotion className="mt-12 rounded-2xl border border-dashed border-white/15 p-10 text-center">
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
        </StudioItemMotion>
      ) : (
        <StudioItemMotion className="mt-10">
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
          <ProjectTable projects={projects} />
        </StudioItemMotion>
      )}

      {(archivedProjects.length > 0 || deletedProjects.length > 0) && (
        <StudioItemMotion className="mt-12">
          <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">
            Ablage
          </p>
          {archivedProjects.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-sm font-medium text-white/70">Archiviert</div>
              <ProjectTable projects={archivedProjects} archived />
            </div>
          )}
          {deletedProjects.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/70">Gelöscht</span>
                <span className="text-xs text-white/35">30 Tage wiederherstellbar</span>
              </div>
              <ProjectTable projects={deletedProjects} deleted />
            </div>
          )}
        </StudioItemMotion>
      )}

    </StudioPageMotion>
  );
}

/** A cell-filling link to the project, so clicking anywhere on a row
 *  (except the actions cell) opens it. Deleted rows are not clickable. */
function RowLink({
  id,
  deleted,
  className,
  children,
}: {
  id: string;
  deleted: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (deleted) return <span className={className}>{children}</span>;
  return <Link href={`/studio/${id}`} className={className}>{children}</Link>;
}

type ProjectListItem = Awaited<ReturnType<typeof fetchSpacesByOwner>>[number];

function ProjectTable({
  projects,
  archived = false,
  deleted = false,
}: {
  projects: ProjectListItem[];
  archived?: boolean;
  deleted?: boolean;
}) {
  return (
    <div className="overflow-visible rounded-2xl border border-white/12">
      <table className="w-full border-collapse text-left">
        <thead className="bg-white/[0.04]">
          <tr className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            <th className="px-4 py-3 font-normal">Projekt</th>
            <th className="px-4 py-3 font-normal">Phase</th>
            <th className="px-4 py-3 font-normal">Typ</th>
            <th className="px-4 py-3 font-normal">{deleted ? "Gelöscht" : archived ? "Archiviert" : "Erstellt"}</th>
            <th className="px-4 py-3 text-right font-normal">Aktionen</th>
          </tr>
        </thead>
        <StudioTableBodyMotion>
          {projects.map((p) => (
            <StudioTableRowMotion key={p.id} className="border-t border-white/10 text-white/78 hover:bg-white/[0.035]">
              <td className="px-4 py-4">
                {deleted ? (
                  <span className="font-body text-[15px] font-medium text-white/72">
                    {p.title || "Unbenanntes Projekt"}
                  </span>
                ) : (
                  <Link href={`/studio/${p.id}`} className="font-body text-[15px] font-medium text-white hover:underline">
                    {p.title || "Unbenanntes Projekt"}
                  </Link>
                )}
              </td>
              <td className="p-0">
                <RowLink id={p.id} deleted={deleted} className="block px-4 py-4 mono text-[11px] uppercase tracking-widest text-white/55">
                  {p.stage ? STAGE_LABEL[p.stage] : "—"}
                </RowLink>
              </td>
              <td className="p-0">
                <RowLink id={p.id} deleted={deleted} className="block px-4 py-4 mono text-[11px] uppercase tracking-widest text-white/35">
                  {p.segment ?? "—"}
                </RowLink>
              </td>
              <td className="p-0">
                <RowLink id={p.id} deleted={deleted} className="block px-4 py-4 mono text-[11px] tracking-widest text-white/35">
                  {relTime(deleted ? (p.deletedAt ?? p.createdAt) : archived ? (p.archivedAt ?? p.createdAt) : p.createdAt)}
                </RowLink>
              </td>
              <td className="px-4 py-4">
                <div className="flex justify-end">
                  <ProjectCardActions
                    id={p.id}
                    title={p.title}
                    shared={p.shared}
                    archived={archived}
                    deleted={deleted}
                  />
                </div>
              </td>
            </StudioTableRowMotion>
          ))}
        </StudioTableBodyMotion>
      </table>
    </div>
  );
}
