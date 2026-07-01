"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import type { HeadingWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { EditControls } from "./EditControls";
import { useInlineEdit } from "./useInlineEdit";

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
 */
export function HeadingRenderer({
  module: m,
  index,
}: {
  module: HeadingWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const { editing, setEditing, cancel, commit, editProps } = useInlineEdit<HTMLTextAreaElement>({
    value: m.text,
    onSave: (text) => ctx.saveModule(index, { ...m, text }),
    submitOn: "enter",
    autoGrow: true,
  });

  const sizeClass = SIZE_BY_LEVEL[m.level];
  const empty = !m.text.trim();

  return (
    <WidgetShell
      module={m}
      index={index}
    >
      {editing ? (
        <div className="relative">
          <textarea
            {...editProps}
            placeholder={m.placeholder ?? "Projekttitel eingeben"}
            maxLength={200}
            rows={1}
            className={`vibe-heading font-black ${sizeClass} leading-[0.95] w-full bg-transparent border-0 outline-none resize-none overflow-hidden`}
            style={{ color: "var(--v-fg)" }}
          />
          <EditControls onSave={commit} onCancel={cancel} />
        </div>
      ) : (
        <h1
          onClick={() => { if (ctx.isOwner) setEditing(true); }}
          className={`vibe-heading font-black ${sizeClass} leading-[0.95] ${ctx.isOwner ? "cursor-text" : ""}`}
          style={{ color: empty ? "var(--v-muted)" : "var(--v-fg)" }}
        >
          {empty ? (m.placeholder ?? "Projekttitel eingeben") : m.text}
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
