"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import type { AISummaryWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { EditControls } from "./EditControls";
import { useInlineEdit } from "./useInlineEdit";

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
  const { editing, setEditing, cancel, commit, editProps } = useInlineEdit<HTMLTextAreaElement>({
    value: m.text,
    onSave: (text) => ctx.saveModule(index, { ...m, text }),
    autoGrow: true,
  });

  return (
    <WidgetShell
      module={m}
      index={index}
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
      <WidgetCard microTitle={m.microTitle || undefined} description={m.description}>
        <div className="relative">
          {editing ? (
            <div>
              <textarea
                {...editProps}
                maxLength={1200}
                rows={3}
                className="text-[17px] sm:text-[18px] leading-relaxed w-full bg-transparent border-0 outline-none resize-none overflow-hidden pr-7"
                style={{ color: "var(--v-fg)" }}
              />
              <EditControls onSave={commit} onCancel={cancel} />
            </div>
          ) : (
            <p
              onClick={() => { if (ctx.isOwner) setEditing(true); }}
              className={`text-[17px] sm:text-[18px] leading-relaxed whitespace-pre-wrap pr-7 ${ctx.isOwner ? "cursor-text" : ""}`}
              style={{ color: "var(--v-fg)" }}
            >
              {m.text}
            </p>
          )}
          {/* The AI mark — prominent, tucked bottom-right. */}
          <span
            aria-hidden
            className="absolute bottom-0 right-0 text-[20px] leading-none pointer-events-none select-none"
            style={{ color: "var(--v-accent)" }}
          >
            ✦
          </span>
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
