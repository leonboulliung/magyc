"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { PhasesWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Phasen — chronological phase arc visualised as a horizontal
 * progress track. The current phase is highlighted; completed phases
 * are filled; future phases are outlined.
 *
 * Owner can advance or retreat the current phase by clicking on
 * any phase node. The update writes the new currentPhase index back
 * to the widget config via PUT.
 *
 * Regenerate returns alternative phase sequences (3–5 phases, different
 * duration labels). Phases are always seeded with labels; the AI
 * handler in regenerate.ts already covers this type.
 *
 * No external chart library — pure SVG + CSS so the vibe tokens
 * (--v-fg, --v-rule, --v-accent, --v-muted) control the palette.
 */
export function PhasesRenderer({
  module: m,
  index,
}: {
  module: PhasesWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const phases = m.phases;
  const current = Math.max(0, Math.min(m.currentPhase, phases.length - 1));

  const [saving, setSaving] = useState(false);

  async function setPhase(i: number) {
    if (!ctx.isOwner || saving || i === current) return;
    setSaving(true);
    await ctx.saveModule(index, { ...m, currentPhase: i });
    setSaving(false);
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "phases" ? (
          <div className="space-y-0.5">
            <div className="mono text-[10px] tracking-widest opacity-60">
              {s.phases.length} phases
            </div>
            <div className="text-[12px] truncate">
              {s.phases.map((p) => p.label).join(" → ")}
            </div>
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {/* Vertical timeline — shows every phase with full label + description. */}
        <ol className="relative">
          {phases.map((phase, i) => {
            const done = i < current;
            const active = i === current;
            const last = i === phases.length - 1;
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Connector line to the next node */}
                {!last && (
                  <span
                    aria-hidden
                    className="absolute"
                    style={{ left: 6, top: 14, bottom: 0, width: 2, background: done ? "var(--v-fg)" : "var(--v-rule)" }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setPhase(i)}
                  disabled={!ctx.isOwner || saving}
                  className="flex flex-1 items-start gap-3 text-left"
                  style={{ cursor: ctx.isOwner ? "pointer" : "default" }}
                  aria-label={`Phase ${i + 1}: ${phase.label}`}
                >
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1.2 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-[1] mt-1 shrink-0"
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: "2px solid",
                      background: done || active ? "var(--v-fg)" : "var(--v-bg)",
                      borderColor: done || active ? "var(--v-fg)" : "var(--v-rule)",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[13px] leading-snug"
                      style={{ color: active || done ? "var(--v-fg)" : "var(--v-muted)", fontWeight: active ? 700 : 500 }}
                    >
                      {phase.label}
                    </span>
                    {phase.description && (
                      <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: "var(--v-muted)" }}>
                        {phase.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Owner step controls */}
        {ctx.isOwner && phases.length > 1 && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPhase(current - 1)}
              disabled={current === 0 || saving}
              className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full disabled:opacity-30"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
            >
              ←
            </button>
            <span className="mono text-[9px] tabular-nums opacity-50" style={{ color: "var(--v-muted)" }}>
              {current + 1}/{phases.length}
            </span>
            <button
              type="button"
              onClick={() => setPhase(current + 1)}
              disabled={current === phases.length - 1 || saving}
              className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full disabled:opacity-30"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
            >
              →
            </button>
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
