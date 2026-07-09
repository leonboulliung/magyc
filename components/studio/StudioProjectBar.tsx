"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/LocaleProvider";
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
import { PROJECT_STAGE_LABELS, PROJECT_STAGE_ORDER } from "@/lib/projectStages";

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
  canAdvance = canManage,
  surface = "dark",
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
  /** Team members may move work forward without gaining share/admin rights. */
  canAdvance?: boolean;
  /** Lightness of the surface the bar floats over, so its pills stay legible. */
  surface?: "light" | "dark";
}) {
  const light = surface === "light";
  // Pill chrome + tab states adapt to the surface below the bar.
  const chip = light
    ? "border-black/12 bg-white/85 text-black/70 backdrop-blur-md hover:text-black"
    : "border-white/15 bg-black/78 text-white/80 hover:text-white";
  const activeTab = light ? "bg-[#17171a] text-white" : "bg-white text-black";
  const inactiveTab = light ? "text-black/55 hover:text-black" : "text-white/55 hover:text-white";
  const lockedTab = light ? "text-black/25" : "text-white/25";
  const arrowMuted = light ? "text-black/40" : "text-white/40";
  const menuBg = light ? "#ffffff" : "#16181b";
  const menuBorder = light ? "border-black/10" : "border-white/12";
  const router = useRouter();
  const tr = useT();
  const [current, setCurrent] = useState<ProjectStage>(stage ?? "brief");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<ProjectStage | null>(null);
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const currentIdx = PROJECT_STAGE_ORDER.indexOf(current);
  const viewLabel = PROJECT_STAGE_LABELS.find((s) => s.id === view)?.label ?? "Planung";

  /** What a tab does: view a reached stage, advance to the next, or nothing. */
  function tabKind(s: ProjectStage): "view" | "advance" | "locked" {
    const i = PROJECT_STAGE_ORDER.indexOf(s);
    if (i <= currentIdx) return "view";
    if (!canAdvance) return "locked";
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
      showActionLoading(tr.studio.savingStage, `stage-${id}`);
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        showApiError(tr.studio.stageNotSaved, json, {
          id: `stage-${id}`,
          fallback: tr.studio.stageSaveFailed,
        });
        return;
      }
      showActionSuccess(next === "production" ? tr.studio.contractPrepared : tr.studio.stageSaved, {
        id: `stage-${id}`,
        description: next === "production" ? "Der Vertragsentwurf wurde automatisch angelegt." : undefined,
      });
      setCurrent(next);
      onAdvance(next); // workspace moves the view forward to the new stage
      router.refresh();
    } catch (error) {
      showUnknownError(tr.studio.stageNotSaved, error, {
        id: `stage-${id}`,
        fallback: tr.studio.stageSaveFailed,
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
        aria-label={tr.studio.backToStudio}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors ${chip}`}
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
          className={`mono flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] uppercase tracking-widest transition-colors disabled:opacity-60 ${chip}`}
        >
          {viewLabel}
          <span aria-hidden className={`text-[8px] ${arrowMuted}`}>▾</span>
        </button>
        {stageMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />
            <div className={`absolute left-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border py-1 shadow-2xl ${menuBorder}`} style={{ background: menuBg, minWidth: "150px" }}>
              {PROJECT_STAGE_LABELS.map((s) => {
                const kind = tabKind(s.id);
                const active = s.id === view;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onTab(s.id)}
                    disabled={busy || kind === "locked"}
                    className={`mono block w-full px-4 py-2.5 text-left text-[11px] uppercase tracking-widest transition-colors disabled:opacity-30 ${active ? (light ? "text-black" : "text-white") : (light ? "text-black/55 hover:text-black" : "text-white/50 hover:text-white")}`}
                  >
                    {active && <span className="mr-2 text-[8px]">●</span>}
                    {s.label}
                    {kind === "advance" && <span className={`ml-2 ${arrowMuted}`}>→</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Desktop: 3-stage stepper (view / advance / locked) */}
      <div className={`hidden sm:flex items-center gap-1 rounded-full border p-1 ${light ? "border-black/12 bg-white/85 backdrop-blur-md" : "border-white/15 bg-black/78"}`}>
        {PROJECT_STAGE_LABELS.map((s) => {
          const kind = tabKind(s.id);
          const active = s.id === view;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onTab(s.id)}
              disabled={busy || kind === "locked"}
              title={kind === "locked" ? tr.studio.finishPreviousStage : undefined}
              className={`mono rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                active
                  ? activeTab
                  : kind === "locked"
                    ? lockedTab
                    : inactiveTab
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
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors ${chip}`}
        >
          <span aria-hidden>↗</span>
          <span className="hidden sm:inline">{shared ? "Geteilt" : "Teilen"}</span>
        </button>
      )}

      {segment && (
        <span className={`mono hidden h-8 items-center rounded-full border px-2.5 text-[10px] uppercase tracking-widest lg:inline-flex ${light ? "border-black/12 bg-white/80 text-black/45 backdrop-blur-md" : "border-white/12 bg-black/72 text-white/40"}`}>
          {segment}
        </span>
      )}

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />

      <Dialog open={pendingStage !== null} onOpenChange={(o) => { if (!o) setPendingStage(null); }} title={advancingToHandoff ? tr.studio.finishProjectTitle : tr.studio.prepareContract} maxWidth={420}>
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#16181b] text-left shadow-2xl">
          <div className="space-y-3 p-5">
            <div className="mono text-[10px] uppercase tracking-widest text-amber-300/80">
              {advancingToHandoff ? tr.studio.stageFixed : tr.studio.planLocked}
            </div>
            <h2 className="text-[17px] font-semibold text-white">
              {advancingToHandoff ? tr.studio.finishProjectQ : tr.studio.prepareContractQ}
            </h2>
            <p className="text-[13px] leading-relaxed text-white/65">
              {advancingToHandoff
                ? tr.studio.finishProjectDesc
                : tr.studio.prepareContractDesc}
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
              {advancingToHandoff ? tr.studio.finish : tr.studio.lockAndContinue}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
