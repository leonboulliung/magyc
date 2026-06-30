"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import type { RichTextWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { EditControls } from "./EditControls";
import { useInlineEdit } from "./useInlineEdit";

/**
 * Rich-text widget renderer.
 *
 *   Two editable surfaces:
 *     - microTitle: small mono uppercase label ("Kontext", "Idea", …)
 *     - text: the body prose
 *
 *   Both edit inline on click (owner only). Blur or Enter saves;
 *   Escape cancels. Placeholders shown when fields are empty.
 *
 *   The regenerate ↻ surfaces 3 alternative microTitle+text pairs.
 */
export function RichTextRenderer({
  module: m,
  index,
}: {
  module: RichTextWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const title = useInlineEdit<HTMLInputElement>({
    value: m.microTitle ?? "",
    onSave: (v) => ctx.saveModule(index, { ...m, microTitle: v || undefined }),
    submitOn: "enter",
    focusMode: "all",
  });
  const body = useInlineEdit<HTMLTextAreaElement>({
    value: m.text,
    onSave: (text) => ctx.saveModule(index, { ...m, text }),
    trim: false,
    autoGrow: true,
  });

  const emptyBody = !m.text.trim();

  return (
    <WidgetShell
      module={m}
      index={index}
      promptEditable
      onManualEdit={() => body.setEditing(true)}
      renderSuggestion={(s) =>
        s.type === "rich_text" ? (
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
      <div className="space-y-2">
        {/* Micro-title row */}
        {title.editing ? (
          <input
            {...title.editProps}
            placeholder="…"
            maxLength={60}
            className="mono text-[10px] tracking-widest uppercase bg-transparent border-0 outline-none px-0 py-0"
            style={{ color: "var(--v-muted)" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => { if (ctx.isOwner) title.setEditing(true); }}
            disabled={!ctx.isOwner}
            className={`mono text-[10px] tracking-widest uppercase block ${ctx.isOwner ? "cursor-text" : "cursor-default"}`}
            style={{
              color: m.microTitle ? "var(--v-muted)" : "var(--v-rule-strong, var(--v-rule))",
              background: "transparent",
              border: "none",
              padding: 0,
              textAlign: "left",
            }}
          >
            {m.microTitle || "…"}
          </button>
        )}

        {/* Body */}
        {body.editing ? (
          <div className="max-w-2xl">
            <textarea
              {...body.editProps}
              placeholder={m.placeholder ?? ""}
              maxLength={4000}
              rows={3}
              className="vibe-heading text-[17px] sm:text-[19px] leading-relaxed w-full bg-transparent border-0 outline-none resize-none overflow-hidden"
              style={{ color: "var(--v-fg)" }}
            />
            <EditControls onSave={body.commit} onCancel={body.cancel} />
          </div>
        ) : (
          <p
            onClick={() => { if (ctx.isOwner) body.setEditing(true); }}
            className={`vibe-heading text-[17px] sm:text-[19px] leading-relaxed max-w-2xl whitespace-pre-wrap ${ctx.isOwner ? "cursor-text" : ""}`}
            style={{ color: emptyBody ? "var(--v-muted)" : "var(--v-fg)" }}
          >
            {emptyBody ? (m.placeholder ?? "…") : m.text}
          </p>
        )}
      </div>
    </WidgetShell>
  );
}
