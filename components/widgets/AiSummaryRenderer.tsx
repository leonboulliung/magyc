"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { AISummaryWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { EditControls } from "./EditControls";

/**
 * Ki-Einordnung — short AI take. Renders the text with a small ✦
 * mark. Owners can edit inline, accept a regenerate alternative,
 * or paste a custom prompt the regenerate uses as guidance.
 *
 * The CSV calls for 4 alternatives by default + a custom-prompt
 * affordance; both flow through the shared WidgetShell. The prompt
 * field lives in the suggestions popover.
 */
export function AiSummaryRenderer({
  module: m,
  index,
}: {
  module: AISummaryWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(m.text); }, [m.text]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
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
    ctx.patchModule(index, { ...m, text: next });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      canRegenerate={false}
      promptEditable
      onManualEdit={() => setEditing(true)}
      renderSuggestion={(s) =>
        s.type === "ai_summary" ? (
          <div className="space-y-0.5">
            {s.microTitle && (
              <div className="mono text-[9px] tracking-widest opacity-60 uppercase">
                {s.microTitle}
              </div>
            )}
            <div className="text-[13px] leading-snug line-clamp-3">{s.text}</div>
          </div>
        ) : null
      }
    >
      <WidgetCard
        microTitle={
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ color: "var(--v-accent)" }}>✦</span>
            <span>{m.microTitle ?? ""}</span>
          </span>
        }
        description={m.description}
      >
        {editing ? (
          <div>
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); autoResize(e.currentTarget); }}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
                else if (e.key === "Escape") { e.preventDefault(); setDraft(m.text); setEditing(false); }
              }}
              maxLength={1200}
              rows={3}
              className="text-[15px] leading-relaxed w-full bg-transparent border-0 outline-none resize-none overflow-hidden"
              style={{ color: "var(--v-fg)" }}
            />
            <EditControls
              onSave={save}
              onCancel={() => { setDraft(m.text); setEditing(false); }}
            />
          </div>
        ) : (
          <p
            onClick={() => { if (ctx.isOwner) setEditing(true); }}
            className={`text-[15px] leading-relaxed whitespace-pre-wrap ${ctx.isOwner ? "cursor-text" : ""}`}
            style={{ color: "var(--v-fg)" }}
          >
            {m.text}
          </p>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
