"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { DiscussionWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

/**
 * Diskussion — chronological chat with arbitrary-depth replies.
 *
 * Every message is a `voice` action carrying { id, text, parentId? }.
 * The tree is rebuilt on render. A single composer at the bottom posts
 * a top-level message; a per-message ↵ opens an inline reply.
 *
 * No regenerate — purely user content.
 */
export function DiscussionRenderer({
  module: m,
  index,
  state,
}: {
  module: DiscussionWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  const voices = state
    .filter((e) => e.kind === "voice")
    .sort((a, b) => a.createdAt - b.createdAt);

  // Index by message id, then build child lists.
  const byId = new Map<string, ModuleStateEntry>();
  for (const e of voices) {
    const id = typeof e.data.id === "string" ? (e.data.id as string) : e.id;
    byId.set(id, e);
  }
  const children = new Map<string, ModuleStateEntry[]>();
  const tops: ModuleStateEntry[] = [];
  for (const e of voices) {
    const parentId = typeof e.data.parentId === "string" ? (e.data.parentId as string) : null;
    if (parentId && byId.has(parentId)) {
      const arr = children.get(parentId) || [];
      arr.push(e);
      children.set(parentId, arr);
    } else {
      tops.push(e);
    }
  }

  const [pending, setPending] = useState("");
  const [open, setOpen] = useState(false);

  async function post(parentId: string | null, text: string) {
    const v = text.trim();
    if (!v) return;
    await ctx.act(index, "voice", {
      id: newId(),
      text: v,
      parentId: parentId || undefined,
    });
  }

  async function postTop() {
    const v = pending;
    setPending("");
    setOpen(false);
    await post(null, v);
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {tops.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                <MessageNode
                  entry={e}
                  childMap={children}
                  depth={0}
                  onReply={(parentId, text) => post(parentId, text)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-3">
          {open ? (
            <textarea
              autoFocus
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={postTop}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); postTop(); }
                else if (e.key === "Escape") { setPending(""); setOpen(false); }
              }}
              rows={2}
              maxLength={1500}
              placeholder="…"
              className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-md"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="write a message"
              className={`flex items-center gap-2 mono text-[11px] tracking-widest px-3 py-2 rounded-md opacity-70 hover:opacity-100 transition-opacity ${tops.length === 0 ? "w-full" : ""}`}
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
            >
              <span aria-hidden>↩</span>
              <span className="opacity-70">{m.placeholder || "…"}</span>
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

const MAX_DEPTH = 4;

function MessageNode({
  entry,
  childMap,
  depth,
  onReply,
}: {
  entry: ModuleStateEntry;
  childMap: Map<string, ModuleStateEntry[]>;
  depth: number;
  onReply: (parentId: string, text: string) => Promise<void> | void;
}) {
  const myId = typeof entry.data.id === "string" ? (entry.data.id as string) : entry.id;
  const kids = childMap.get(myId) || [];
  const [replyOpen, setReplyOpen] = useState(false);
  const [pending, setPending] = useState("");

  async function submit() {
    const v = pending;
    setPending("");
    setReplyOpen(false);
    await onReply(myId, v);
  }

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <ActorDot
          color={typeof entry.data.color === "string" ? (entry.data.color as string) : undefined}
          displayName={entry.actor.displayName}
          size={16}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] leading-snug whitespace-pre-wrap" style={{ color: "var(--v-fg)" }}>
            {String(entry.data.text ?? "")}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="mono text-[9px] tracking-widest opacity-50" style={{ color: "var(--v-muted)" }}>
              {entry.actor.displayName || "anon"}
            </div>
            {depth < MAX_DEPTH && (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="mono text-[9px] tracking-widest opacity-40 hover:opacity-100"
                style={{ color: "var(--v-fg)" }}
              >
                ↵
              </button>
            )}
          </div>

          {replyOpen && (
            <textarea
              autoFocus
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
                else if (e.key === "Escape") { setPending(""); setReplyOpen(false); }
              }}
              rows={2}
              maxLength={1000}
              placeholder="…"
              className="mt-2 w-full text-[12.5px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-md"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          )}

          {kids.length > 0 && (
            <ul
              className="mt-2 space-y-2 pl-3"
              style={{ borderLeft: "1px solid var(--v-rule)" }}
            >
              {kids.map((c) => (
                <li key={c.id}>
                  <MessageNode
                    entry={c}
                    childMap={childMap}
                    depth={depth + 1}
                    onReply={onReply}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function newId(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}`;
}
