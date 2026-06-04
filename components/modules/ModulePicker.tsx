"use client";

import type { CardModule } from "@/lib/types";

/**
 * ModulePicker — manual chooser for a module type. The owner can
 * always pick the module that fits their thing, independent of (or
 * after rejecting) what the AI suggests. Each option carries a tiny
 * glyph echoing its display surface so the choice reads visually.
 *
 * Used wherever an owner needs to switch / add a module type by hand:
 * the empty state, the "↻ switch type" action on an existing module,
 * and the sandbox.
 */
const OPTIONS: {
  type: CardModule["type"];
  name: string;
  glyph: string;
  blurb: string;
}[] = [
  { type: "brief",     glyph: "❝",  name: "Brief",     blurb: "One sentence: why this exists." },
  { type: "roadmap",   glyph: "01", name: "Roadmap",   blurb: "Chronological steps to make it happen." },
  { type: "checklist", glyph: "☐",  name: "Checklist", blurb: "Unordered list of things still to do." },
  { type: "bring",     glyph: "●",  name: "Bring",     blurb: "What participants bring along." },
  { type: "kv",        glyph: "▭",  name: "Details",   blurb: "Key–value spec: LOOKS, STACK, GENRE." },
  { type: "moodboard", glyph: "▦",  name: "Moodboard", blurb: "Visual references — images + captions." },
  { type: "setlist",   glyph: "⏵",  name: "Setlist",   blurb: "The programme during the event." },
  { type: "reflist",   glyph: "↗",  name: "Reflist",   blurb: "External links: inspirations, sources." },
];

export function ModulePicker({
  current,
  onPick,
  onCancel,
  title = "Pick a module",
  hint,
}: {
  /** Currently-selected module type, if any — gets a "CURRENT" tag. */
  current?: CardModule["type"];
  onPick: (type: CardModule["type"]) => void;
  onCancel?: () => void;
  title?: string;
  /** Optional one-line note above the grid (e.g. "AI didn't find a fit"). */
  hint?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="mono text-[10px] tracking-widest opacity-60">CHOOSE A SHAPE</div>
          <h3 className="editorial font-black text-[20px] leading-none mt-1">{title}</h3>
          {hint && (
            <p className="mono text-[10px] opacity-70 mt-1.5 leading-snug">{hint}</p>
          )}
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100"
          >
            CANCEL
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {OPTIONS.map((o) => {
          const isCurrent = current === o.type;
          return (
            <button
              key={o.type}
              onClick={() => onPick(o.type)}
              className={`text-left border rounded-2xl px-3.5 py-3 transition-colors flex items-start gap-3 ${
                isCurrent
                  ? "border-ink bg-ink/[0.04]"
                  : "border-rule hover:border-ink/40 hover:bg-ink/[0.02]"
              }`}
            >
              <span
                className="mono text-[16px] leading-none pt-0.5 opacity-80 w-6 shrink-0 tabular-nums"
                aria-hidden
              >
                {o.glyph}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline gap-2 flex-wrap">
                  <span className="mono text-[11px] tracking-widest uppercase">{o.name}</span>
                  {isCurrent && (
                    <span className="mono text-[9px] tracking-widest opacity-60">· CURRENT</span>
                  )}
                </span>
                <span className="mono text-[10px] opacity-60 leading-snug block mt-0.5">
                  {o.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
