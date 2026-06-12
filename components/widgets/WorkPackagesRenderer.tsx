"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { getSelfId } from "@/lib/state";
import type { ModuleStateEntry, WorkPackagesWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

/**
 * Arbeitspakete — Apple-Wallet-style stacked cards, one per work
 * package. Collaborators claim packages via `claim` actions (slotLabel
 * = package label). Like Crew, each package has a segment-share button.
 *
 * The wallet stack collapses when not focused; clicking expands. (For
 * now we render all expanded — the gesture treatment lives in Phase 5
 * polish.)
 */
export function WorkPackagesRenderer({
  module: m,
  index,
  state,
}: {
  module: WorkPackagesWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  const latestPerActorPkg = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "claim") continue;
    const slot = typeof e.data.slotLabel === "string" ? (e.data.slotLabel as string) : "";
    if (!slot) continue;
    latestPerActorPkg.set(`${e.actor.id}::${slot}`, e);
  }
  const buckets = new Map<string, ModuleStateEntry[]>();
  for (const [, e] of latestPerActorPkg) {
    if (e.data.claimed === false) continue;
    const slot = (e.data.slotLabel as string) || "";
    const arr = buckets.get(slot) || [];
    arr.push(e);
    buckets.set(slot, arr);
  }

  const myId = getSelfId();

  function iClaimed(slot: string): boolean {
    return (buckets.get(slot) || []).some((e) => e.actor.id === myId);
  }

  async function toggleClaim(slot: string) {
    const next = !iClaimed(slot);
    await ctx.act(index, "claim", { slotLabel: slot, claimed: next });
  }

  async function sharePkg(slot: string) {
    const url = `${window.location.origin}${window.location.pathname}?pkg=${encodeURIComponent(slot)}`;
    try { await navigator.clipboard.writeText(url); } catch { /* no-op */ }
  }

  const [hover, setHover] = useState<string | null>(null);

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "work_packages" ? (
          <ul className="text-[11px] leading-snug opacity-80 list-disc pl-4">
            {s.packages.slice(0, 4).map((p, i) => (
              <li key={i} className="truncate">{p.label}</li>
            ))}
          </ul>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {m.packages.map((pkg) => {
              const claimers = buckets.get(pkg.label) || [];
              const mine = iClaimed(pkg.label);
              return (
                <motion.div
                  key={pkg.label}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  onMouseEnter={() => setHover(pkg.label)}
                  onMouseLeave={() => setHover(null)}
                  className="rounded-[var(--v-radius)] p-3 relative"
                  style={{
                    background: "var(--v-bg)",
                    border: `1px solid ${mine ? "var(--v-fg)" : "var(--v-rule)"}`,
                    boxShadow: mine
                      ? "0 1px 3px rgba(0,0,0,0.06)"
                      : "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleClaim(pkg.label)}
                      aria-label={mine ? "release" : "claim"}
                      className="shrink-0 mt-0.5 inline-flex items-center justify-center transition-all"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "9999px",
                        border: `1.5px solid ${mine ? "var(--v-fg)" : "var(--v-rule)"}`,
                        background: mine ? "var(--v-fg)" : "transparent",
                      }}
                    >
                      {mine && (
                        <span className="mono text-[9px]" style={{ color: "var(--v-bg)" }}>
                          ✓
                        </span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
                        {pkg.label}
                      </div>
                      {pkg.description && (
                        <div className="text-[12px] leading-snug mt-0.5" style={{ color: "var(--v-muted)" }}>
                          {pkg.description}
                        </div>
                      )}
                      {claimers.length > 0 && (
                        <div className="flex -space-x-1.5 mt-2">
                          {claimers.slice(0, 6).map((e) => (
                            <span
                              key={e.id}
                              style={{ border: "1.5px solid var(--v-bg)", borderRadius: "9999px" }}
                            >
                              <ActorDot
                                color={typeof e.data.color === "string" ? (e.data.color as string) : undefined}
                                displayName={e.actor.displayName}
                                size={18}
                              />
                            </span>
                          ))}
                          {claimers.length > 6 && (
                            <span className="mono text-[9px] tabular-nums ml-2 self-center" style={{ color: "var(--v-muted)" }}>
                              +{claimers.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {hover === pkg.label && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          onClick={() => sharePkg(pkg.label)}
                          aria-label="share package"
                          title="copy share link"
                          className="mono text-[11px] opacity-60 hover:opacity-100 shrink-0"
                          style={{ color: "var(--v-fg)" }}
                        >
                          ⎘
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
