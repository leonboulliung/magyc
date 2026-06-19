"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { getSelfId } from "@/lib/state";
import type { LocationSuggestionsWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

/**
 * Location-Vorschläge — candidate places as a TEXT list with vote
 * dots stacked on the right, no visible map.
 *
 * Votes live in module_state as `vote` actions carrying { option }
 * where option is the suggestion label. Same model as PollRenderer
 * but for places: each actor has one active vote; switching replaces
 * the old one.
 *
 * The CSV: "Location-Vorschläge — proposed places presented as a
 * TEXT list (no visible map), with a signal/vote-style stacking of
 * profile dots."
 */
export function LocationSuggestionsRenderer({
  module: m,
  index,
  state,
}: {
  module: LocationSuggestionsWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  // Last vote per actor.
  const latestByActor = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "vote") continue;
    latestByActor.set(e.actor.id, e);
  }

  const myId = getSelfId();
  const myEntry = latestByActor.get(myId);
  const mine = myEntry && typeof myEntry.data.option === "string"
    ? (myEntry.data.option as string)
    : null;

  // Bucket per suggestion label.
  const buckets = new Map<string, ModuleStateEntry[]>();
  for (const e of latestByActor.values()) {
    const opt = typeof e.data.option === "string" ? (e.data.option as string) : "";
    if (!opt) continue;
    const arr = buckets.get(opt) || [];
    arr.push(e);
    buckets.set(opt, arr);
  }

  async function vote(label: string) {
    const next = mine === label ? "" : label;
    await ctx.act(index, "vote", { option: next });
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {m.suggestions.length === 0 && (
          <p className="mono text-[11px] opacity-50" style={{ color: "var(--v-muted)" }}>Noch keine Orts-Vorschläge.</p>
        )}

        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {m.suggestions.map((sug, i) => {
              const voters = buckets.get(sug.label) || [];
              const selected = mine === sug.label;
              return (
                <motion.li
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 3 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-3 py-2 px-1"
                  style={{ borderBottom: "1px solid var(--v-rule)" }}
                >
                  <button
                    type="button"
                    onClick={() => vote(sug.label)}
                    className="shrink-0 mt-0.5 inline-flex items-center justify-center transition-all"
                    aria-label={selected ? "unvote" : "vote"}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "9999px",
                      border: `1.5px solid ${selected ? "var(--v-fg)" : "var(--v-rule)"}`,
                      background: selected ? "var(--v-fg)" : "transparent",
                    }}
                  >
                    {selected && (
                      <span className="mono text-[8px]" style={{ color: "var(--v-bg)" }}>●</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
                      {sug.label}
                    </div>
                    {sug.address && (
                      <div className="mono text-[10px] mt-0.5 opacity-60 truncate" style={{ color: "var(--v-muted)" }}>
                        {sug.address}
                      </div>
                    )}
                  </div>

                  {voters.length > 0 && (
                    <div className="flex -space-x-1.5 shrink-0 items-center">
                      <AnimatePresence initial={false}>
                        {voters.slice(0, 5).map((v) => (
                          <motion.span
                            key={v.actor.id}
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ duration: 0.12 }}
                            style={{ border: "1.5px solid var(--v-bg)", borderRadius: "9999px" }}
                          >
                            <ActorDot
                              color={typeof v.data.color === "string" ? (v.data.color as string) : undefined}
                              displayName={v.actor.displayName}
                              size={16}
                            />
                          </motion.span>
                        ))}
                      </AnimatePresence>
                      {voters.length > 5 && (
                        <span className="mono text-[9px] ml-2 tabular-nums" style={{ color: "var(--v-muted)" }}>
                          +{voters.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </WidgetCard>
    </WidgetShell>
  );
}
