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
  { id: "production", label: "Auswahl" },
  { id: "handoff", label: "Abgeschlossen" },
];
const ORDER: ProjectStage[] = ["brief", "production", "handoff"];

/**
 * StudioProjectBar — the workspace's top-left control: back to Studio, the
 * lifecycle stepper, and sharing. The lifecycle is FORWARD-ONLY: tabs for
 * stages already reached switch the *view* (read-only inspection of an earlier
 * surface), the single next stage is the advance action (confirmed, locks the
 * plan), and later stages are disabled. A stage is never reset — advancing
 * persists via PATCH /api/projects/[id]; `onView`/`onAdvance` drive the
 * surrounding workspace.
 */
export function StudioProjectBar({
  id,
  stage,
  segment,
  shared,
  view,
  onView,
  onAdvance,
  canManage = true,
}: {
  id: string;
  stage: ProjectStage | null;
  segment: string | null;
  shared: boolean;
  /** The currently shown surface (defaults to the lifecycle stage). */
  view: ProjectStage;
  onView: (s: ProjectStage) => void;
  /** Called after a successful forward advance, with the new stage. */
  onAdvance: (s: ProjectStage) => void;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<ProjectStage>(stage ?? "brief");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<ProjectStage | null>(null);
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const currentIdx = ORDER.indexOf(current);
  const viewLabel = STAGES.find((s) => s.id === view)?.label ?? "Planung";

  /** What a tab does: view a reached stage, advance to the next, or nothing. */
  function tabKind(s: ProjectStage): "view" | "advance" | "locked" {
    const i = ORDER.indexOf(s);
    if (i <= currentIdx) return "view";
    if (!canManage) return "locked";
    if (i === currentIdx + 1) return "advance";
    return "locked";
  }

  function onTab(s: ProjectStage) {
    if (busy) return;
    const kind = tabKind(s);
    if (kind === "view") { onView(s); setStageMenuOpen(false); return; }
    if (kind === "advance") { setPendingStage(s); setStageMenuOpen(false); }
  }

  async function advance(next: ProjectStage) {
    if (busy) return;
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
        showApiError("Phase nicht gespeichert", json, {
          id: `stage-${id}`,
          fallback: "Die Projektphase konnte nicht gespeichert werden.",
        });
        return;
      }
      showActionSuccess("Phase gespeichert", { id: `stage-${id}` });
      setCurrent(next);
      onAdvance(next); // workspace moves the view forward to the new stage
      router.refresh();
    } catch (error) {
      showUnknownError("Phase nicht gespeichert", error, {
        id: `stage-${id}`,
        fallback: "Die Projektphase konnte nicht gespeichert werden.",
      });
    } finally {
      setBusy(false);
    }
  }

  const advancingToHandoff = pendingStage === "handoff";

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

      {/* Mobile: compact dropdown of the stages */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setStageMenuOpen((o) => !o)}
          disabled={busy}
          className="mono flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-md transition-colors hover:text-white disabled:opacity-60"
        >
          {viewLabel}
          <span aria-hidden className="text-[8px] text-white/40">▾</span>
        </button>
        {stageMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-white/12 py-1 shadow-2xl" style={{ background: "#16181b", minWidth: "150px" }}>
              {STAGES.map((s) => {
                const kind = tabKind(s.id);
                const active = s.id === view;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onTab(s.id)}
                    disabled={busy || kind === "locked"}
                    className={`mono block w-full px-4 py-2.5 text-left text-[11px] uppercase tracking-widest transition-colors disabled:opacity-30 ${active ? "text-white" : "text-white/50 hover:text-white"}`}
                  >
                    {active && <span className="mr-2 text-[8px]">●</span>}
                    {s.label}
                    {kind === "advance" && <span className="ml-2 text-white/40">→</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Desktop: 3-stage stepper (view / advance / locked) */}
      <div className="hidden sm:flex items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1 backdrop-blur-md">
        {STAGES.map((s) => {
          const kind = tabKind(s.id);
          const active = s.id === view;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onTab(s.id)}
              disabled={busy || kind === "locked"}
              title={kind === "locked" ? "Erst die vorige Phase abschließen" : undefined}
              className={`mono rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                active
                  ? "bg-white text-black"
                  : kind === "locked"
                    ? "text-white/25"
                    : "text-white/55 hover:text-white"
              }`}
            >
              {s.label}
              {kind === "advance" && <span aria-hidden className="ml-1.5 opacity-60">→</span>}
            </button>
          );
        })}
      </div>

      {canManage && (
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 text-[12px] text-white/80 backdrop-blur-md transition-colors hover:text-white"
        >
          <span aria-hidden>↗</span>
          <span className="hidden sm:inline">{shared ? "Geteilt" : "Teilen"}</span>
        </button>
      )}

      {segment && (
        <span className="mono hidden rounded-full border border-white/12 bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/40 backdrop-blur-md lg:inline">
          {segment}
        </span>
      )}

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />

      <Dialog open={pendingStage !== null} onOpenChange={(o) => { if (!o) setPendingStage(null); }} title={advancingToHandoff ? "Projekt abschließen" : "In die Auswahl"} maxWidth={420}>
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#16181b] text-left shadow-2xl">
          <div className="space-y-3 p-5">
            <div className="mono text-[10px] uppercase tracking-widest text-amber-300/80">
              {advancingToHandoff ? "Phase wird fixiert" : "Plan wird gesperrt"}
            </div>
            <h2 className="text-[17px] font-semibold text-white">
              {advancingToHandoff ? "Projekt abschließen?" : "In die Auswahl verschieben?"}
            </h2>
            <p className="text-[13px] leading-relaxed text-white/65">
              {advancingToHandoff
                ? "Danach ist das Projekt abgeschlossen. Frühere Phasen kannst du weiter ansehen, aber die Phase lässt sich nicht mehr zurücksetzen."
                : "Danach ist die Projektseite gesperrt — am Plan sind keine Änderungen mehr möglich, und die Phase lässt sich nicht zurücksetzen. Du arbeitest ab dann am Vertrag und gibst ihn selbst zur Unterschrift frei."}
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
              onClick={() => { const next = pendingStage; setPendingStage(null); if (next) void advance(next); }}
              disabled={busy}
              className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {advancingToHandoff ? "Abschließen" : "Sperren & fortfahren"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
