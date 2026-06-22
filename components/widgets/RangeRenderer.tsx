"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import type { RangeWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { useInlineEdit } from "./useInlineEdit";

/**
 * Range (Von-Bis) — two parameters with an icon hint per `unit`.
 *
 * Owner click → inline edit of either field. Enter saves. Esc cancels.
 */
export function RangeRenderer({
  module: m,
  index,
}: {
  module: RangeWidget;
  index: number;
}) {
  const ctx = useWidgetContext();

  const icon = ICON_FOR_UNIT[m.unit] ?? "↔";

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "range" ? (
          <div className="mono text-[12px]">
            {s.from} — {s.to}
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="flex items-center gap-3">
          <span
            className="text-[18px] shrink-0 opacity-50"
            style={{ color: "var(--v-muted)" }}
            aria-hidden
          >
            {icon}
          </span>
          <RangeField
            value={m.from}
            onSave={async (next) => save(index, m, { from: next }, ctx)}
            isOwner={ctx.isOwner}
          />
          <span className="opacity-40 mono text-[12px]">→</span>
          <RangeField
            value={m.to}
            onSave={async (next) => save(index, m, { to: next }, ctx)}
            isOwner={ctx.isOwner}
          />
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function RangeField({
  value,
  onSave,
  isOwner,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
  isOwner: boolean;
}) {
  // Shared click-to-edit wiring. The `if (next)` guard preserves RangeField's
  // original "never save an emptied field" behaviour (the hook itself would
  // save an empty value); focusMode "all" + submitOn "enter" match the prior
  // select-on-focus / Enter-saves feel.
  const { editing, setEditing, editProps } = useInlineEdit<HTMLInputElement>({
    value,
    onSave: (next) => { if (next) return onSave(next); },
    submitOn: "enter",
    focusMode: "all",
  });

  return editing ? (
    <input
      {...editProps}
      maxLength={120}
      className="text-[16px] bg-transparent border-0 outline-none flex-1 min-w-0"
      style={{ color: "var(--v-fg)" }}
    />
  ) : (
    <button
      type="button"
      onClick={() => { if (isOwner) setEditing(true); }}
      disabled={!isOwner}
      className={`text-[16px] flex-1 min-w-0 text-left truncate ${isOwner ? "cursor-text" : ""}`}
      style={{ color: "var(--v-fg)", background: "transparent", border: "none", padding: 0 }}
    >
      {value}
    </button>
  );
}

async function save(
  index: number,
  m: RangeWidget,
  patch: Partial<RangeWidget>,
  ctx: ReturnType<typeof useWidgetContext>,
) {
  await ctx.saveModule(index, { ...m, ...patch });
}

const ICON_FOR_UNIT: Record<RangeWidget["unit"], string> = {
  time:    "◷",
  weekday: "◔",
  month:   "▤",
  year:    "▦",
  date:    "▤",
  place:   "⟶",
  amount:  "#",
  generic: "↔",
};
