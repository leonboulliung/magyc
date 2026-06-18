"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ShareDialog } from "@/components/studio/ShareDialog";
import { studioOverlay, studioPopover } from "@/lib/anim";

/**
 * Per-project actions on the dashboard table: open, share, duplicate,
 * delete. Rendered as a required gear button per project row.
 */
export function ProjectCardActions({ id, title, shared }: { id: string; title: string; shared: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  async function duplicate(e: React.MouseEvent) {
    stop(e);
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.id) router.push(`/studio/${json.id}`);
      else { setBusy(false); setOpen(false); }
    } catch {
      setBusy(false);
      setOpen(false);
    }
  }

  async function remove(e: React.MouseEvent) {
    stop(e);
    if (busy) return;
    if (!window.confirm(`Projekt „${title || "Unbenannt"}" wirklich löschen? Das lässt sich nicht rückgängig machen.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else { setBusy(false); setOpen(false); }
    } catch {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Projekt bearbeiten"
        title="Projekt bearbeiten"
        onClick={(e) => { stop(e); setOpen((v) => !v); }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/55 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.06V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.06-.4H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .4-1.06V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15.4 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.29.36.6.67 1 .85.33.15.7.23 1.06.23H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51.92Z" />
        </svg>
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          initial="hidden"
          animate="show"
          exit="exit"
          variants={studioOverlay}
        >
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={(e) => { stop(e); setOpen(false); }} />
          <motion.div
            variants={studioPopover}
            className="absolute bottom-10 right-0 z-50 w-44 overflow-hidden rounded-xl border border-white/12 bg-black/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-md"
          >
            <Link
              href={`/studio/${id}`}
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Öffnen
            </Link>
            <button
              type="button"
              onClick={(e) => { stop(e); setOpen(false); setShareOpen(true); }}
              className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Teilen …
            </button>
            <button
              type="button"
              onClick={duplicate}
              disabled={busy}
              className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Duplizieren
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-red-300/90 transition-colors hover:bg-red-500/15 disabled:opacity-50"
            >
              Löschen
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
