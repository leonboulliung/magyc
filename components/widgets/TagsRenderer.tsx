"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { TagsWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";

/**
 * Tags widget renderer.
 *
 *   Display: chip list. Each chip is read-only by default; on hover
 *            an × appears that removes it (owner only). The trailing
 *            "+" chip opens an inline input that adds a tag on Enter.
 *
 *   Regenerate: ↻ surfaces 3 full alternative tag-set candidates.
 *
 * Edits hit the PUT widget endpoint with the next tags array.
 */
export function TagsRenderer({
  module: m,
  index,
}: {
  module: TagsWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  async function commit(next: string[]) {
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, tags: next },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    ctx.refresh();
  }

  async function add() {
    const v = pending.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    setPending("");
    setAdding(false);
    if (!v) return;
    if (m.tags.some((t) => t.toLowerCase() === v)) return;
    await commit([...m.tags, v]);
  }

  async function remove(tag: string) {
    await commit(m.tags.filter((t) => t !== tag));
  }

  const hasTags = m.tags.length > 0;

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "tags" ? (
          <div className="flex flex-wrap gap-1">
            {s.tags.map((t, i) => (
              <span
                key={i}
                className="mono text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-1.5 items-center">
        <AnimatePresence initial={false}>
          {m.tags.map((t) => (
            <motion.span
              key={t}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="group/tag mono text-[10px] tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
            >
              <span>{t.toUpperCase()}</span>
              {ctx.isOwner && (
                <button
                  onClick={() => remove(t)}
                  aria-label="remove"
                  className="opacity-30 hover:opacity-100 transition-opacity"
                  style={{ color: "var(--v-fg)" }}
                >
                  ×
                </button>
              )}
            </motion.span>
          ))}
        </AnimatePresence>

        {ctx.isOwner && (
          adding ? (
            <input
              ref={inputRef}
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={add}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); add(); }
                else if (e.key === "Escape") { setPending(""); setAdding(false); }
              }}
              maxLength={40}
              placeholder="…"
              className="mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-transparent outline-none"
              style={{
                border: "1px solid var(--v-fg)",
                color: "var(--v-fg)",
                minWidth: "72px",
              }}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              aria-label="add tag"
              className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{
                border: "1px dashed var(--v-rule)",
                color: "var(--v-fg)",
                background: "transparent",
              }}
            >
              +
            </button>
          )
        )}

        {!ctx.isOwner && !hasTags && (
          <span
            className="mono text-[10px] tracking-widest opacity-30"
            style={{ color: "var(--v-muted)" }}
          >
            …
          </span>
        )}
      </div>
    </WidgetShell>
  );
}
