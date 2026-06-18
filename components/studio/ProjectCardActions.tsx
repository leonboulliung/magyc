"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "@/components/ui/Dialog";
import { ShareDialog } from "@/components/studio/ShareDialog";
import { studioOverlay, studioPopover } from "@/lib/anim";
import {
  readApiJson,
  showActionLoading,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";

/**
 * Per-project actions on the dashboard table: open, share, duplicate,
 * archive, restore, soft-delete. Rendered as a required gear button per
 * project row.
 */
export function ProjectCardActions({
  id,
  title,
  shared,
  archived = false,
  deleted = false,
}: {
  id: string;
  title: string;
  shared: boolean;
  archived?: boolean;
  deleted?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
      showActionLoading("Projekt wird dupliziert …", `duplicate-${id}`);
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const json = await readApiJson(res);
      if (res.ok && typeof json?.id === "string") {
        showActionSuccess("Projekt dupliziert", { id: `duplicate-${id}` });
        router.push(`/studio/${json.id}`);
      } else {
        showApiError("Duplizieren fehlgeschlagen", json, {
          id: `duplicate-${id}`,
          fallback: "Das Projekt konnte nicht dupliziert werden.",
        });
        setBusy(false);
        setOpen(false);
      }
    } catch (error) {
      showUnknownError("Duplizieren fehlgeschlagen", error, {
        id: `duplicate-${id}`,
        fallback: "Das Projekt konnte nicht dupliziert werden.",
      });
      setBusy(false);
      setOpen(false);
    }
  }

  async function patchProject(
    e: React.MouseEvent,
    body: Record<string, boolean>,
    labels: { loading: string; success: string; error: string; fallback: string; id: string },
  ) {
    stop(e);
    if (busy) return;
    setBusy(true);
    try {
      showActionLoading(labels.loading, labels.id);
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readApiJson(res);
      if (res.ok) {
        showActionSuccess(labels.success, { id: labels.id });
        setOpen(false);
        router.refresh();
      } else {
        showApiError(labels.error, json, {
          id: labels.id,
          fallback: labels.fallback,
        });
        setBusy(false);
        setOpen(false);
      }
    } catch (error) {
      showUnknownError(labels.error, error, {
        id: labels.id,
        fallback: labels.fallback,
      });
      setBusy(false);
      setOpen(false);
    }
  }

  async function archive(e: React.MouseEvent) {
    await patchProject(e, { archived: true }, {
      loading: "Projekt wird archiviert …",
      success: "Projekt archiviert",
      error: "Archivieren fehlgeschlagen",
      fallback: "Das Projekt konnte nicht archiviert werden.",
      id: `archive-${id}`,
    });
  }

  async function restore(e: React.MouseEvent) {
    await patchProject(e, { archived: false, deleted: false }, {
      loading: "Projekt wird wiederhergestellt …",
      success: "Projekt wiederhergestellt",
      error: "Wiederherstellen fehlgeschlagen",
      fallback: "Das Projekt konnte nicht wiederhergestellt werden.",
      id: `restore-${id}`,
    });
  }

  function requestRemove(e: React.MouseEvent) {
    stop(e);
    if (busy) return;
    setOpen(false);
    setDeleteOpen(true);
  }

  async function confirmRemove() {
    if (busy) return;
    setBusy(true);
    try {
      showActionLoading("Projekt wird gelöscht …", `delete-${id}`);
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const json = await readApiJson(res);
      if (res.ok) {
        showActionSuccess("Projekt in Gelöscht verschoben", { id: `delete-${id}` });
        setDeleteOpen(false);
        router.refresh();
      } else {
        showApiError("Löschen fehlgeschlagen", json, {
          id: `delete-${id}`,
          fallback: "Das Projekt konnte nicht gelöscht werden.",
        });
        setBusy(false);
        setDeleteOpen(false);
      }
    } catch (error) {
      showUnknownError("Löschen fehlgeschlagen", error, {
        id: `delete-${id}`,
        fallback: "Das Projekt konnte nicht gelöscht werden.",
      });
      setBusy(false);
      setDeleteOpen(false);
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
            {!deleted && (
              <button
                type="button"
                onClick={(e) => { stop(e); setOpen(false); setShareOpen(true); }}
                className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Teilen …
              </button>
            )}
            {!deleted && (
              <button
                type="button"
                onClick={duplicate}
                disabled={busy}
                className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Duplizieren
              </button>
            )}
            {!archived && !deleted && (
              <button
                type="button"
                onClick={archive}
                disabled={busy}
                className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Archivieren
              </button>
            )}
            {(archived || deleted) && (
              <button
                type="button"
                onClick={restore}
                disabled={busy}
                className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Wiederherstellen
              </button>
            )}
            <button
              type="button"
              onClick={requestRemove}
              disabled={busy}
              hidden={deleted}
              className="block w-full rounded-lg px-3 py-2 text-left font-body text-sm text-red-300/90 transition-colors hover:bg-red-500/15 disabled:opacity-50"
            >
              Löschen
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Projekt löschen" maxWidth={420}>
        <div className="rounded-2xl border border-white/12 bg-[#050505] p-5 text-white shadow-2xl shadow-black/60">
          <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Gelöscht-Bereich</p>
          <h2 className="mt-2 text-xl font-semibold">Projekt verschieben?</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            {title || "Dieses Projekt"} wird aus der aktiven Liste entfernt und bleibt 30 Tage im
            Gelöscht-Bereich wiederherstellbar.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
              className="rounded-full border border-white/12 px-4 py-2 text-sm text-white/65 transition-colors hover:border-white/30 hover:text-white disabled:opacity-45"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={confirmRemove}
              disabled={busy}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-45"
            >
              In Gelöscht verschieben
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
