"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShareDialog } from "@/components/studio/ShareDialog";
import { Dialog } from "@/components/ui/Dialog";
import {
  readApiJson,
  showActionLoading,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";
import type { ProjectStage } from "@/lib/types";

const STAGES: { id: ProjectStage; label: string }[] = [
  { id: "brief", label: "Planung" },
  { id: "production", label: "Absegnung" },
  { id: "handoff", label: "Abschluss" },
];

/**
 * StudioProjectBar — the thin overlay on a project workspace: a back link
 * to the dashboard + the lifecycle stage stepper. Fixed top-left so it
 * never collides with SpaceView's owner toolbar (top-right). Changing the
 * stage persists via PATCH /api/projects/[id]; stage-specific workspace
 * behaviour comes in later phases.
 */
export function StudioProjectBar({
  id,
  stage,
  segment,
  shared,
}: {
  id: string;
  stage: ProjectStage | null;
  segment: string | null;
  shared: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<ProjectStage>(stage ?? "brief");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<ProjectStage | null>(null);
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const currentLabel = STAGES.find((s) => s.id === current)?.label ?? "Planung";

  // The project page is locked once it leaves Planung (production/handoff).
  // Two transitions change that lock state and must be deliberate:
  //  - entering a locked stage from Planung → confirm (plan gets frozen)
  //  - returning to Planung from a locked stage → confirm (plan re-opens)
  // Transitions between the two locked stages apply immediately.
  const lockedStage = (s: ProjectStage) => s === "production" || s === "handoff";
  const reopening = pendingStage === "brief";

  function requestStage(next: ProjectStage) {
    if (next === current || busy) return;
    const entersLock = lockedStage(next) && current === "brief";
    const reopens = next === "brief" && lockedStage(current);
    if (entersLock || reopens) {
      setPendingStage(next);
      return;
    }
    void setStage(next);
  }

  async function setStage(next: ProjectStage) {
    if (next === current || busy) return;
    const prev = current;
    setCurrent(next); // optimistic
    setBusy(true);
    try {
      showActionLoading("Phase wird gespeichert …", `stage-${id}`);
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        setCurrent(prev); // rollback
        // contract_signed (locked plan) is mapped centrally in apiErrorMessage.
        showApiError("Phase nicht gespeichert", json, {
          id: `stage-${id}`,
          fallback: "Die Projektphase konnte nicht gespeichert werden.",
        });
      } else {
        showActionSuccess("Phase gespeichert", { id: `stage-${id}` });
        router.refresh();
      }
    } catch (error) {
      setCurrent(prev);
      showUnknownError("Phase nicht gespeichert", error, {
        id: `stage-${id}`,
        fallback: "Die Projektphase konnte nicht gespeichert werden.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed left-3 top-3 z-50 flex items-center gap-2 sm:left-4 sm:top-4">
      <Link
        href="/studio"
        aria-label="Zurück zum Studio"
        className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 text-[12px] text-white/80 backdrop-blur-md transition-colors hover:text-white"
      >
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">Studio</span>
      </Link>

      {/* Mobile: compact dropdown showing current stage */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setStageMenuOpen((o) => !o)}
          disabled={busy}
          className="mono flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-md transition-colors hover:text-white disabled:opacity-60"
        >
          {currentLabel}
          <span aria-hidden className="text-[8px] text-white/40">▾</span>
        </button>
        {stageMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-white/12 py-1 shadow-2xl" style={{ background: "#16181b", minWidth: "140px" }}>
              {STAGES.map((s) => {
                const active = s.id === current;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStageMenuOpen(false); requestStage(s.id); }}
                    disabled={busy}
                    className={`mono block w-full px-4 py-2.5 text-left text-[11px] uppercase tracking-widest transition-colors disabled:opacity-50 ${active ? "text-white" : "text-white/50 hover:text-white"}`}
                  >
                    {active && <span className="mr-2 text-[8px]">●</span>}{s.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Desktop: full 3-pill stepper */}
      <div className="hidden sm:flex items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1 backdrop-blur-md">
        {STAGES.map((s) => {
          const active = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => requestStage(s.id)}
              disabled={busy}
              className={`mono rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors disabled:opacity-60 ${
                active ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 text-[12px] text-white/80 backdrop-blur-md transition-colors hover:text-white"
      >
        <span aria-hidden>↗</span>
        <span className="hidden sm:inline">{shared ? "Geteilt" : "Teilen"}</span>
      </button>

      {segment && (
        <span className="mono hidden rounded-full border border-white/12 bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/40 backdrop-blur-md lg:inline">
          {segment}
        </span>
      )}

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />

      <Dialog open={pendingStage !== null} onOpenChange={(o) => { if (!o) setPendingStage(null); }} title={reopening ? "Zurück zur Planung" : "Projektseite sperren"} maxWidth={420}>
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#16181b] text-left shadow-2xl">
          <div className="space-y-3 p-5">
            <div className="mono text-[10px] uppercase tracking-widest text-amber-300/80">{reopening ? "Plan wird wieder bearbeitbar" : "Plan wird gesperrt"}</div>
            <h2 className="text-[17px] font-semibold text-white">{reopening ? "Zurück zur Planung?" : "Projektseite sperren?"}</h2>
            <p className="text-[13px] leading-relaxed text-white/65">
              {reopening
                ? "Die Projektseite wird wieder bearbeitbar. Ein bereits erstellter Vertragsentwurf bleibt erhalten, ist aber nicht mehr abgesichert, solange der Plan offen ist."
                : "Danach ist die Projektseite gesperrt — am Plan sind keine Änderungen mehr möglich. Du arbeitest ab dann am Vertragsentwurf und gibst ihn selbst zur Unterschrift frei."}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/30 px-5 py-3.5">
            <button
              type="button"
              onClick={() => setPendingStage(null)}
              disabled={busy}
              className="rounded-full px-4 py-2 text-[13px] text-white/65 transition-colors hover:text-white disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => { const next = pendingStage; setPendingStage(null); if (next) void setStage(next); }}
              disabled={busy}
              className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {reopening ? "Plan wieder öffnen" : "Sperren & fortfahren"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
