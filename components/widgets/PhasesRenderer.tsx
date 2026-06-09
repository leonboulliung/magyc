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
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, currentPhase: i },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    setSaving(false);
    ctx.refresh();
  }

  // Progress: 0 → full at last phase.
  const progress = phases.length <= 1 ? 1 : current / (phases.length - 1);

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
        {/* Progress track */}
        <div className="relative mb-5" style={{ paddingTop: 8 }}>
          {/* Background rail */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{ height: 2, background: "var(--v-rule)", marginTop: 12 }}
          />
          {/* Filled rail */}
          <motion.div
            className="absolute top-0 left-0"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ height: 2, background: "var(--v-fg)", marginTop: 12 }}
          />

          {/* Phase nodes */}
          <div className="flex justify-between relative" style={{ zIndex: 1 }}>
            {phases.map((phase, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhase(i)}
                  disabled={!ctx.isOwner || saving}
                  className="flex flex-col items-center gap-1.5"
                  style={{ cursor: ctx.isOwner ? "pointer" : "default", flex: 1 }}
                  aria-label={`Phase ${i + 1}: ${phase.label}`}
                >
                  {/* Node dot */}
                  <motion.div
                    initial={false}
                    animate={{
                      scale: active ? 1.25 : 1,
                      background: done || active ? "var(--v-fg)" : "var(--v-bg)",
                      borderColor: done || active ? "var(--v-fg)" : "var(--v-rule)",
                    }}
                    transition={{ duration: 0.2 }}
                    style={{
                      width: active ? 14 : 10,
                      height: active ? 14 : 10,
                      borderRadius: "50%",
                      border: "2px solid",
                      background: done || active ? "var(--v-fg)" : "var(--v-bg)",
                      borderColor: done || active ? "var(--v-fg)" : "var(--v-rule)",
                      position: "relative",
                      zIndex: 2,
                    }}
                  />
                  {/* Label */}
                  <span
                    className="mono text-[9px] tracking-wide text-center leading-tight"
                    style={{
                      maxWidth: "5rem",
                      color: active ? "var(--v-fg)" : done ? "var(--v-muted)" : "var(--v-rule)",
                      fontWeight: active ? 700 : 400,
                      wordBreak: "break-word",
                    }}
                  >
                    {phase.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description of current phase */}
        {phases[current]?.description && (
          <div
            className="mt-2 text-[12px] leading-snug"
            style={{ color: "var(--v-muted)" }}
          >
            {phases[current].description}
          </div>
        )}

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
