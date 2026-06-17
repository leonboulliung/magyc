"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Per-project actions on a dashboard card: duplicate, delete. Rendered as
 * a "⋯" button in the card corner; stops propagation so it doesn't trigger
 * the card's link. Share/collaboration comes in Phase D.
 */
export function ProjectCardActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        aria-label="Projekt-Aktionen"
        onClick={(e) => { stop(e); setOpen((v) => !v); }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={(e) => { stop(e); setOpen(false); }} />
          <div className="absolute right-0 top-9 z-50 w-40 overflow-hidden rounded-xl border border-white/12 bg-black/95 p-1 backdrop-blur-md">
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
          </div>
        </>
      )}
    </div>
  );
}
