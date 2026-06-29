"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { newLocalId } from "@/lib/id";
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
    await ctx.act(index, "add", { id: newLocalId("n"), text: v });
  }

  async function editNote(id: string, text: string) {
    await ctx.act(index, "edit", { id, text });
  }

  async function deleteNote(id: string) {
    await ctx.act(index, "edit", { id, deleted: true });
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {notes.length === 0 && (
          <p
            className="mono text-[11px] opacity-50 mb-3"
            style={{ color: "var(--v-muted)" }}
          >
            {m.placeholder ?? "Noch keine Notiz — schreib die erste."}
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
                <NoteCard note={n} onEdit={(text) => editNote(n.id, text)} onDelete={() => deleteNote(n.id)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-3">
          {adding ? (
            <div className="space-y-1.5">
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
                placeholder="Notiz schreiben"
                rows={2}
                className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-[var(--v-radius)]"
                style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
              />
              <p className="mono text-[9px] tracking-widest opacity-45" style={{ color: "var(--v-muted)" }}>
                Ctrl/⌘ + Enter saves
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Notiz hinzufügen"
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-70 hover:opacity-100 transition-opacity"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              + Eintrag hinzufügen
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
  // Append-only log → a delete is an `edit` carrying { deleted: true }, so
  // no extra server route is needed. Collect them and filter at the end.
  const deleted = new Set<string>();
  for (const e of entries) {
    if (e.kind === "add") {
      const id = String(e.data.id ?? e.id);
      const text = String(e.data.text ?? "");
      byId.set(id, {
        id,
        text: cleanNoteText(text),
        authorName: e.actor.displayName,
        authorColor: typeof e.data.color === "string" ? e.data.color : undefined,
        createdAt: e.createdAt,
      });
    } else if (e.kind === "edit") {
      const id = typeof e.data.id === "string" ? e.data.id : null;
      if (!id) continue;
      if (e.data.deleted === true) { deleted.add(id); continue; }
      const existing = byId.get(id);
      if (existing) existing.text = cleanNoteText(e.data.text ?? existing.text);
    }
  }
  return [...byId.values()]
    .filter((n) => !deleted.has(n.id))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: Note;
  onEdit: (text: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  async function save() {
    setEditing(false);
    if (draft !== note.text) await onEdit(draft);
  }

  return (
    <div
      className="group/note relative rounded-[var(--v-radius)] p-3 transition-colors"
      style={{
        background: "var(--v-bg)",
        border: "1px solid var(--v-rule)",
      }}
    >
      {!editing && (
        <button
          type="button"
          onClick={() => onDelete()}
          aria-label="Notiz löschen"
          className="mono absolute right-2 top-2 text-[13px] opacity-0 transition-opacity group-hover/note:opacity-50 hover:!opacity-100"
          style={{ color: "var(--v-muted)" }}
        >
          ×
        </button>
      )}
      <div className="flex items-start gap-2.5">
        <ActorDot color={note.authorColor} displayName={note.authorName || "Mitglied"} size={16} />
        {editing ? (
          <div className="min-w-0 flex-1 space-y-1.5">
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
              className="w-full resize-none border-0 bg-transparent text-[13px] leading-relaxed outline-none [overflow-wrap:anywhere]"
              style={{ color: "var(--v-fg)" }}
            />
            <p className="mono text-[9px] tracking-widest opacity-45" style={{ color: "var(--v-muted)" }}>
              Ctrl/⌘ + Enter saves
            </p>
          </div>
        ) : (
          <div
            onClick={() => setEditing(true)}
            className="min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words text-[13px] leading-relaxed [overflow-wrap:anywhere]"
            style={{ color: "var(--v-fg)" }}
          >
            {note.text || "Notiz schreiben"}
          </div>
        )}
      </div>
    </div>
  );
}

function cleanNoteText(value: unknown): string {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 1000);
}
