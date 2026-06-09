"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { postState } from "@/lib/state";
import type { ModuleStateEntry, NotesWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

/**
 * Notes — Apple-Wallet-style stack of editable note cards.
 *
 * Each note is an `add` action carrying { id, text }. Editing writes
 * an `edit` action with { id, text }. Anyone can add and edit. The
 * CSV explicitly notes that note edits do NOT bump the space version
 * — they're a conversational layer on top of the workspace config.
 */
export function NotesRenderer({
  module: m,
  index,
  state,
}: {
  module: NotesWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const notes = buildNotes(state);
  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    const v = pending.trim();
    setPending("");
    setAdding(false);
    if (!v) return;
    await postState(ctx.spaceId, index, "add", { id: newId(), text: v });
    ctx.refresh();
  }

  async function editNote(id: string, text: string) {
    await postState(ctx.spaceId, index, "edit", { id, text });
    ctx.refresh();
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {notes.length === 0 && (
          <p
            className="mono text-[11px] opacity-50 mb-3"
            style={{ color: "var(--v-muted)" }}
          >
            {m.placeholder ?? "…"}
          </p>
        )}

        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.li
                key={n.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
              >
                <NoteCard note={n} onEdit={(text) => editNote(n.id, text)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-3">
          {adding ? (
            <textarea
              autoFocus
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={add}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); }
                else if (e.key === "Escape") { setPending(""); setAdding(false); }
              }}
              maxLength={1000}
              placeholder="…"
              rows={2}
              className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-md"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="add"
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              +
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

interface Note {
  id: string;
  text: string;
  authorName?: string;
  authorColor?: string;
  createdAt: number;
}

function buildNotes(entries: ModuleStateEntry[]): Note[] {
  const byId = new Map<string, Note>();
  for (const e of entries) {
    if (e.kind === "add") {
      const id = String(e.data.id ?? e.id);
      const text = String(e.data.text ?? "");
      byId.set(id, {
        id,
        text,
        authorName: e.actor.displayName,
        authorColor: typeof e.data.color === "string" ? e.data.color : undefined,
        createdAt: e.createdAt,
      });
    } else if (e.kind === "edit") {
      const id = typeof e.data.id === "string" ? e.data.id : null;
      if (!id) continue;
      const existing = byId.get(id);
      if (existing) existing.text = String(e.data.text ?? existing.text);
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function NoteCard({
  note,
  onEdit,
}: {
  note: Note;
  onEdit: (text: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  async function save() {
    setEditing(false);
    if (draft !== note.text) await onEdit(draft);
  }

  return (
    <div
      className="rounded-md p-3 transition-colors"
      style={{
        background: "var(--v-bg)",
        border: "1px solid var(--v-rule)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <ActorDot color={note.authorColor} displayName={note.authorName} size={16} />
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
              else if (e.key === "Escape") { setDraft(note.text); setEditing(false); }
            }}
            rows={3}
            maxLength={1000}
            className="flex-1 text-[13px] leading-relaxed bg-transparent border-0 outline-none resize-none"
            style={{ color: "var(--v-fg)" }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            className="flex-1 text-[13px] leading-relaxed cursor-text whitespace-pre-wrap"
            style={{ color: "var(--v-fg)" }}
          >
            {note.text || "…"}
          </div>
        )}
      </div>
    </div>
  );
}

function newId(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}
