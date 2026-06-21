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
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Moving into Absegnung locks the project page for good. Gate that one
  // transition behind a confirmation; every other transition applies at once.
  function requestStage(next: ProjectStage) {
    if (next === current || busy) return;
    if (next === "production") {
      setConfirmOpen(true);
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

      <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1 backdrop-blur-md">
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} title="In die Absegnung verschieben" maxWidth={420}>
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#16181b] text-left shadow-2xl">
          <div className="space-y-3 p-5">
            <div className="mono text-[10px] uppercase tracking-widest text-amber-300/80">Plan wird gesperrt</div>
            <h2 className="text-[17px] font-semibold text-white">In die Absegnung verschieben?</h2>
            <p className="text-[13px] leading-relaxed text-white/65">
              Danach ist die Projektseite gesperrt — am Plan sind keine Änderungen
              mehr möglich. Du arbeitest ab dann am Vertragsentwurf und gibst ihn
              selbst zur Unterschrift frei.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/30 px-5 py-3.5">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
              className="rounded-full px-4 py-2 text-[13px] text-white/65 transition-colors hover:text-white disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => { setConfirmOpen(false); void setStage("production"); }}
              disabled={busy}
              className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Sperren & fortfahren
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
