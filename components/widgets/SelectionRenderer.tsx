"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newLocalId } from "@/lib/id";
import { getSelfId } from "@/lib/state";
import { useWidgetContext } from "@/lib/widgetContext";
import type { ModuleStateEntry, SelectionWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { UploadZone } from "./UploadZone";

interface Photo {
  id: string;
  url: string;
  name: string;
}
interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

/**
 * Selection — post-shoot proofing-lite. The owner uploads a set of photos;
 * collaborators (anyone with the share link) select/favourite each photo
 * and leave comments. Selection = `check` per photo (itemKey = photo id);
 * comments = `voice` with parentId = photo id. All content lives in
 * module_state, so this reuses /upload + /state unchanged.
 */
export function SelectionRenderer({
  module: m,
  index,
  state,
}: {
  module: SelectionWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const myId = getSelfId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState("");

  const photos: Photo[] = state
    .filter((e) => e.kind === "upload" && typeof e.data.mimeType === "string" && (e.data.mimeType as string).startsWith("image/"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      id: e.id,
      url: typeof e.data.url === "string" ? (e.data.url as string) : "",
      name: typeof e.data.name === "string" ? (e.data.name as string) : "",
    }))
    .filter((p) => p.url);

  // Selections: latest check state per (actor, photo).
  const latestCheck = new Map<string, boolean>(); // `${actor}::${photoId}` -> checked
  for (const e of state) {
    if (e.kind !== "check") continue;
    const itemKey = typeof e.data.itemKey === "string" ? e.data.itemKey : null;
    if (!itemKey) continue;
    latestCheck.set(`${e.actor.id}::${itemKey}`, !!e.data.checked);
  }
  function selectorsFor(photoId: string): string[] {
    const out: string[] = [];
    for (const [k, checked] of latestCheck) {
      if (!checked) continue;
      const [actor, item] = k.split("::");
      if (item === photoId) out.push(actor);
    }
    return out;
  }
  function isMine(photoId: string): boolean {
    return latestCheck.get(`${myId}::${photoId}`) === true;
  }

  // Comments per photo (voice with parentId).
  const commentsByPhoto = new Map<string, Comment[]>();
  for (const e of state) {
    if (e.kind !== "voice") continue;
    const parentId = typeof e.data.parentId === "string" ? e.data.parentId : null;
    const text = typeof e.data.text === "string" ? (e.data.text as string) : "";
    if (!parentId || !text) continue;
    const arr = commentsByPhoto.get(parentId) || [];
    arr.push({ id: e.id, text, author: e.actor.displayName || "—", createdAt: e.createdAt });
    commentsByPhoto.set(parentId, arr);
  }

  const selectedCount = photos.filter((p) => selectorsFor(p.id).length > 0).length;

  async function toggleSelect(photoId: string) {
    await ctx.act(index, "check", { itemKey: photoId, checked: !isMine(photoId) });
  }
  async function addComment(photoId: string) {
    const text = pending.trim();
    setPending("");
    if (!text) return;
    await ctx.act(index, "voice", { id: newLocalId("cmt"), text, parentId: photoId });
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {photos.length > 0 ? (
          <>
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--v-muted)" }}>
                {selectedCount} / {photos.length} ausgewählt
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
              {photos.map((p) => {
                const selectors = selectorsFor(p.id);
                const mine = isMine(p.id);
                const comments = commentsByPhoto.get(p.id) || [];
                const open = openId === p.id;
                return (
                  <div key={p.id} className="overflow-hidden rounded-[var(--v-radius)]" style={{ border: "1px solid var(--v-rule)" }}>
                    <div className="relative" style={{ aspectRatio: "1 / 1" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => toggleSelect(p.id)}
                        aria-label={mine ? "Auswahl entfernen" : "Auswählen"}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-transform active:scale-90"
                        style={{
                          background: mine ? "#fff" : "rgba(0,0,0,0.5)",
                          color: mine ? "#000" : "#fff",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        {mine ? "✓" : "+"}
                      </button>
                      {selectors.length > 0 && (
                        <span
                          className="mono absolute bottom-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-[9px] tracking-widest"
                          style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                        >
                          ✓ {selectors.length}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOpenId(open ? null : p.id); setPending(""); }}
                      className="mono flex w-full items-center justify-between px-2.5 py-1.5 text-[10px] tracking-widest"
                      style={{ color: "var(--v-muted)" }}
                    >
                      <span>Kommentare {comments.length > 0 ? `(${comments.length})` : ""}</span>
                      <span>{open ? "−" : "+"}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden px-2.5 pb-2.5"
                        >
                          <div className="space-y-1.5">
                            {comments.map((c) => (
                              <div key={c.id} className="text-[12px] leading-snug" style={{ color: "var(--v-fg)" }}>
                                <span className="mono mr-1 text-[10px]" style={{ color: "var(--v-muted)" }}>{c.author}:</span>
                                {c.text}
                              </div>
                            ))}
                          </div>
                          <input
                            value={open ? pending : ""}
                            onChange={(e) => setPending(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addComment(p.id); }
                              else if (e.key === "Escape") { setPending(""); }
                            }}
                            placeholder="Kommentar …"
                            maxLength={500}
                            className="mt-2 w-full rounded-[var(--v-radius)] bg-transparent px-2 py-1 text-[12px] outline-none"
                            style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-4 py-3">
            <p className="mono text-[11px] opacity-50" style={{ color: "var(--v-muted)" }}>
              {m.placeholder ?? (ctx.isOwner ? "Lade Bilder zur Auswahl hoch." : "Noch keine Bilder zur Auswahl.")}
            </p>
          </div>
        )}

        {ctx.isOwner && (
          <div className="px-3 pb-3">
            <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept="image/*" multiple onDone={() => {}}>
              <span className="mono text-[10px] tracking-widest opacity-60">▨ Bilder hinzufügen</span>
            </UploadZone>
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
