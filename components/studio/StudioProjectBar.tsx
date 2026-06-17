"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShareDialog } from "@/components/studio/ShareDialog";
import type { ProjectStage } from "@/lib/types";

const STAGES: { id: ProjectStage; label: string }[] = [
  { id: "brief", label: "Planung" },
  { id: "production", label: "Auswahl" },
  { id: "handoff", label: "Abgeschlossen" },
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

  async function setStage(next: ProjectStage) {
    if (next === current || busy) return;
    const prev = current;
    setCurrent(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) {
        setCurrent(prev); // rollback
      } else {
        router.refresh();
      }
    } catch {
      setCurrent(prev);
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
              onClick={() => setStage(s.id)}
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
    </div>
  );
}
