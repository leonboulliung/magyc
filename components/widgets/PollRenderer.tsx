"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { getSelfId } from "@/lib/state";
import type { ModuleStateEntry, PollWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { InlineText } from "./InlineText";

/**
 * Umfrage — multiple-choice poll.
 *
 * Single vote per actor; switching options replaces the prior vote
 * (last-write-wins from the latest vote action). Voters are stacked
 * as colored dots underneath each option, plus a count.
 */
export function PollRenderer({
  module: m,
  index,
  state,
}: {
  module: PollWidget;
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
  const myEntry = latestByActor.get(myId) || null;
  const mine = myEntry && typeof myEntry.data.option === "string" ? (myEntry.data.option as string) : null;

  // Bucket votes per option.
  const buckets = new Map<string, ModuleStateEntry[]>();
  for (const e of latestByActor.values()) {
    const opt = typeof e.data.option === "string" ? (e.data.option as string) : "";
    if (!opt) continue;
    const arr = buckets.get(opt) || [];
    arr.push(e);
    buckets.set(opt, arr);
  }
  const totalVotes = [...buckets.values()].reduce((s, a) => s + a.length, 0);

  async function vote(option: string) {
    const next = mine === option ? "" : option; // toggle off if same
    await ctx.act(index, "vote", { option: next });
  }

  // Owner config edits (question + options) — persisted via saveModule.
  function save(next: PollWidget) { ctx.saveModule(index, next); }
  function setOption(i: number, v: string) {
    const options = [...m.options];
    options[i] = v;
    save({ ...m, options });
  }
  function addOption() { save({ ...m, options: [...m.options, "Neue Option"] }); }
  function removeOption(i: number) {
    if (m.options.length <= 2) return; // a poll needs at least two
    save({ ...m, options: m.options.filter((_, j) => j !== i) });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "poll" ? (
          <div className="space-y-0.5">
            <div className="text-[12px] truncate">{s.question}</div>
            <div className="mono text-[10px] opacity-60 truncate">
              {s.options.join(" · ")}
            </div>
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="text-[13px] mb-3 leading-snug" style={{ color: "var(--v-fg)" }}>
          <InlineText
            value={m.question}
            isOwner={ctx.isOwner}
            onSave={(v) => save({ ...m, question: v })}
            placeholder="Frage …"
            multiline
            className="text-[13px] leading-snug"
          />
        </div>

        <ul className="space-y-2">
          {m.options.map((opt, i) => {
            const votes = buckets.get(opt) || [];
            const pct = totalVotes ? Math.round((votes.length / totalVotes) * 100) : 0;
            const selected = mine === opt;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => vote(opt)}
                  className="w-full text-left relative overflow-hidden rounded-[var(--v-radius)] transition-colors"
                  style={{
                    border: `1px solid ${selected ? "var(--v-fg)" : "var(--v-rule)"}`,
                    background: "transparent",
                  }}
                >
                  {/* Fill bar */}
                  <motion.div
                    layout
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                    className="absolute inset-y-0 left-0 pointer-events-none"
                    style={{
                      background: selected ? "var(--v-fg)" : "var(--v-rule)",
                      opacity: selected ? 0.12 : 0.5,
                    }}
                  />
                  <div className="relative flex items-center gap-3 px-3 py-2">
                    <span
                      className="mono text-[10px] tabular-nums shrink-0"
                      style={{ color: "var(--v-muted)" }}
                    >
                      {String(pct).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[13px]" style={{ color: "var(--v-fg)" }}>
                      {opt}
                    </span>
                    {votes.length > 0 && (
                      <div className="flex -space-x-1.5 shrink-0">
                        <AnimatePresence initial={false}>
                          {votes.slice(0, 5).map((v) => (
                            <motion.span
                              key={v.actor.id}
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              transition={{ duration: 0.15 }}
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
                        {votes.length > 5 && (
                          <span
                            className="mono text-[9px] tabular-nums ml-2"
                            style={{ color: "var(--v-muted)" }}
                          >
                            +{votes.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {ctx.isOwner && (
          <div className="mt-3 space-y-1.5 rounded-[var(--v-radius)] p-2" style={{ border: "1px dashed var(--v-rule)" }}>
            <p className="mono text-[9px] tracking-widest opacity-50" style={{ color: "var(--v-muted)" }}>OPTIONEN</p>
            {m.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <InlineText
                  value={opt}
                  isOwner
                  onSave={(v) => setOption(i, v)}
                  placeholder="Option …"
                  className="flex-1 text-[12px]"
                />
                {m.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label="Option entfernen"
                    className="mono shrink-0 text-[12px] opacity-40 hover:opacity-100"
                    style={{ color: "var(--v-muted)" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="mono mt-1 rounded-full px-2.5 py-1 text-[10px] tracking-widest opacity-60 hover:opacity-100"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              + Option
            </button>
          </div>
        )}

        {totalVotes > 0 && (
          <div className="mono text-[10px] mt-3 opacity-60" style={{ color: "var(--v-muted)" }}>
            ∑ {totalVotes}
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
