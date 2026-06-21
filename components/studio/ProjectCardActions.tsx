"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShareDialog } from "./ShareDialog";
import {
  readApiJson,
  showActionError,
  showActionSuccess,
  showUnknownError,
} from "@/lib/client/feedback";

/**
 * Per-project edit actions on a dashboard card: a "⋯" menu with Teilen,
 * Duplizieren, Archivieren, Löschen. Rendered as a sibling of the card link
 * so its clicks don't navigate. Wired to the existing project APIs.
 */
export function ProjectCardActions({ id, shared }: { id: string; shared: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, ok: string, fail: string) {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readApiJson(res);
      if (!res.ok) { showActionError(fail, { description: "Bitte erneut versuchen." }); return; }
      void json;
      showActionSuccess(ok);
      router.refresh();
    } catch (e) { showUnknownError(fail, e); }
    finally { setBusy(false); }
  }

  async function duplicate() {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const json = await readApiJson(res) as { id?: string };
      if (!res.ok) { showActionError("Nicht dupliziert", { description: "Bitte erneut versuchen." }); return; }
      showActionSuccess("Projekt dupliziert");
      router.refresh();
      void json;
    } catch (e) { showUnknownError("Nicht dupliziert", e); }
    finally { setBusy(false); }
  }

  function remove() {
    if (typeof window !== "undefined" && !window.confirm("Projekt in den Papierkorb verschieben? (30 Tage wiederherstellbar)")) return;
    void patch({ deleted: true }, "In den Papierkorb verschoben", "Nicht gelöscht");
  }

  const itemClass = "block w-full px-3.5 py-2 text-left text-[13px] text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Projekt-Aktionen"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none text-white/70 transition-colors hover:bg-black/40 hover:text-white"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-white/12 py-1 shadow-2xl"
            style={{ background: "#16181b" }}
          >
            <button type="button" disabled={busy} className={itemClass} onClick={() => { setOpen(false); setShareOpen(true); }}>Teilen …</button>
            <button type="button" disabled={busy} className={itemClass} onClick={duplicate}>Duplizieren</button>
            <button type="button" disabled={busy} className={itemClass} onClick={() => patch({ archived: true }, "Archiviert", "Nicht archiviert")}>Archivieren</button>
            <div className="my-1 h-px bg-white/10" />
            <button type="button" disabled={busy} className={`${itemClass} hover:!text-red-300`} onClick={remove}>Löschen</button>
          </div>
        </>
      )}

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />
    </>
  );
}
