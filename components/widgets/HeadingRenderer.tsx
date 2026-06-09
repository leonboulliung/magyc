"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { HeadingWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";

/**
 * Heading widget renderer.
 *
 *   Display: <h1>-style text sized by `level`. Click → inline edit
 *            (owner only). Blur or Enter saves. Escape cancels.
 *
 *   Empty:   placeholder (AI-generated, prompt-relevant) shown in a
 *            faint colour, only visible while editing the empty
 *            field.
 *
 *   Regenerate: ↻ button reveals on hover (owner only). Surfaces 3
 *               alternative headings via the popover.
 */
export function HeadingRenderer({
  module: m,
  index,
}: {
  module: HeadingWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(m.text);
  }, [m.text]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Place caret at the end.
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
      autoResize(ref.current);
    }
  }, [editing]);

  async function save() {
    const next = draft.trim();
    setEditing(false);
    if (next === m.text) return;
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, text: next },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    ctx.refresh();
  }

  function cancel() {
    setDraft(m.text);
    setEditing(false);
  }

  const sizeClass = SIZE_BY_LEVEL[m.level];
  const empty = !m.text.trim();

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "heading" ? (
          <div className="space-y-0.5">
            <div className="text-[15px] leading-snug font-bold">{s.text}</div>
          </div>
        ) : null
      }
    >
      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoResize(e.currentTarget);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          placeholder={m.placeholder ?? ""}
          maxLength={200}
          rows={1}
          className={`vibe-heading font-black ${sizeClass} leading-[0.95] w-full bg-transparent border-0 outline-none resize-none overflow-hidden`}
          style={{ color: "var(--v-fg)" }}
        />
      ) : (
        <h1
          onClick={() => { if (ctx.isOwner) setEditing(true); }}
          className={`vibe-heading font-black ${sizeClass} leading-[0.95] ${ctx.isOwner ? "cursor-text" : ""}`}
          style={{ color: empty ? "var(--v-muted)" : "var(--v-fg)" }}
        >
          {empty ? (m.placeholder ?? "—") : m.text}
        </h1>
      )}
    </WidgetShell>
  );
}

const SIZE_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-[40px] sm:text-[64px]",
  2: "text-[32px] sm:text-[48px]",
  3: "text-[26px] sm:text-[36px]",
  4: "text-[22px] sm:text-[28px]",
  5: "text-[18px] sm:text-[22px]",
  6: "text-[16px] sm:text-[18px]",
};

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
