"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/LocaleProvider";
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
export function ProjectCardActions({
  id,
  title,
  shared,
  context = "active",
}: {
  id: string;
  title: string;
  shared: boolean;
  context?: "active" | "archived" | "deleted";
}) {
  const router = useRouter();
  const tr = useT();
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
      const json = await readApiJson(res) as { error?: string };
      if (!res.ok) {
        const msg = json.error === "contract_signed"
          ? tr.studio.onlyArchive
          : "Bitte erneut versuchen.";
        showActionError(fail, { description: msg });
        return;
      }
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
      showActionSuccess(tr.studio.projectDuplicated);
      router.refresh();
      void json;
    } catch (e) { showUnknownError("Nicht dupliziert", e); }
    finally { setBusy(false); }
  }

  function remove() {
    if (typeof window !== "undefined" && !window.confirm(tr.studio.confirmTrash)) return;
    void patch({ deleted: true }, tr.studio.movedToTrash, tr.studio.notDeleted);
  }

  function rename() {
    if (typeof window === "undefined") return;
    const next = window.prompt(tr.studio.projectNamePrompt, title || tr.studio.untitledProject);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === title) return;
    void patch({ title: trimmed }, tr.studio.projectRenamed, tr.studio.notRenamed);
  }

  const itemClass = "block w-full px-3.5 py-2 text-left text-[13px] text-black/75 transition-colors hover:bg-black/[0.06] hover:text-[#17171a] disabled:opacity-40";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={tr.studio.projectActions}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none text-white transition-colors hover:bg-white/30"
        style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.32)" }}
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-black/12 py-1 shadow-2xl"
            style={{ background: "#ffffff" }}
          >
            {context === "deleted" ? (
              <button type="button" disabled={busy} className={itemClass} onClick={() => patch({ deleted: false }, "Wiederhergestellt", "Nicht wiederhergestellt")}>Wiederherstellen</button>
            ) : context === "archived" ? (
              <>
                <button type="button" disabled={busy} className={itemClass} onClick={() => patch({ archived: false }, "Wiederhergestellt", "Nicht wiederhergestellt")}>Wiederherstellen</button>
                <button type="button" disabled={busy} className={itemClass} onClick={rename}>Umbenennen</button>
                <button type="button" disabled={busy} className={itemClass} onClick={duplicate}>Duplizieren</button>
                <div className="h-px bg-black/10" />
                <button type="button" disabled={busy} className={`${itemClass} hover:!text-red-300`} onClick={remove}>{tr.common.delete}</button>
              </>
            ) : (
              <>
                <button type="button" disabled={busy} className={itemClass} onClick={rename}>Umbenennen</button>
                <button type="button" disabled={busy} className={itemClass} onClick={() => { setOpen(false); setShareOpen(true); }}>Teilen …</button>
                <button type="button" disabled={busy} className={itemClass} onClick={duplicate}>Duplizieren</button>
                <button type="button" disabled={busy} className={itemClass} onClick={() => patch({ archived: true }, "Archiviert", "Nicht archiviert")}>Archivieren</button>
                <div className="h-px bg-black/10" />
                <button type="button" disabled={busy} className={`${itemClass} hover:!text-red-300`} onClick={remove}>{tr.common.delete}</button>
              </>
            )}
          </div>
        </>
      )}

      <ShareDialog id={id} initialShared={shared} open={shareOpen} onOpenChange={setShareOpen} />
    </>
  );
}
