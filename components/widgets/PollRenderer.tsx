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
  const presetMode = ctx.mode === "preset";

  // Last vote per actor.
  const latestByActor = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "vote") continue;
    latestByActor.set(e.actor.id, e);
  }

  const myId = getSelfId();
  const myEntry = latestByActor.get(myId) || null;
  const mine = myEntry && typeof myEntry.data.option === "string" ? (myEntry.data.option as string) : null;

  const question = cleanPollText(m.question);
  const options = m.options.map(cleanPollText);

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
    if (presetMode) return;
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
  function addOption() { save({ ...m, options: [...m.options, ""] }); }
  function removeOption(i: number) {
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
        <div className="mb-3 text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
          <InlineText
            value={question}
            isOwner={ctx.isOwner}
            onSave={(v) => save({ ...m, question: v })}
            placeholder="Welche Entscheidung soll getroffen werden?"
            multiline
            className="text-[13px] font-medium leading-snug [overflow-wrap:anywhere]"
          />
        </div>

        {options.length === 0 && !ctx.isOwner && (
          <p className="mb-2 text-[12px] opacity-55" style={{ color: "var(--v-muted)" }}>Diese Umfrage ist noch nicht vorbereitet.</p>
        )}

        <ul className="space-y-2">
          {options.map((opt, i) => {
            const votes = buckets.get(opt) || [];
            const pct = totalVotes ? Math.round((votes.length / totalVotes) * 100) : 0;
            const selectable = !!opt.trim();
            const selected = selectable && mine === opt;
            return (
              <li key={i} className="group/option">
                <div
                  role={selectable && !presetMode ? "button" : undefined}
                  tabIndex={selectable && !presetMode ? 0 : -1}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button,input,textarea,[data-poll-control='true']")) return;
                    if (selectable && !presetMode) vote(opt);
                  }}
                  onKeyDown={(e) => {
                    if (!selectable || presetMode) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      vote(opt);
                    }
                  }}
                  className={`relative w-full overflow-hidden rounded-[var(--v-radius)] text-left transition-colors ${selectable && !presetMode ? "cursor-pointer" : "cursor-text"}`}
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
                    {!presetMode && totalVotes > 0 && (
                      <span className="mono shrink-0 text-[10px] tabular-nums" style={{ color: "var(--v-muted)" }}>
                        {pct}%
                      </span>
                    )}
                    <InlineText
                      value={opt}
                      isOwner={ctx.isOwner}
                      onSave={(v) => setOption(i, v)}
                      placeholder={`Option ${i + 1}`}
                      className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] [overflow-wrap:anywhere]"
                    />
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
                    {ctx.isOwner && (
                      <span
                        role="button"
                        data-poll-control="true"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); removeOption(i); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            removeOption(i);
                          }
                        }}
                        aria-label="Option entfernen"
                        className="touch-visible mono grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] leading-none opacity-0 transition-opacity hover:bg-white/10 group-hover/option:opacity-50 hover:!opacity-100"
                        style={{ color: "var(--v-muted)" }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {ctx.isOwner && (
          <button
            type="button"
            onClick={addOption}
            className="mono mt-3 rounded-full px-3 py-1 text-[10px] tracking-widest opacity-70 hover:opacity-100"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
          >
            {options.length === 0 ? "+ Erste Option hinzufügen" : "+ Option hinzufügen"}
          </button>
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

function cleanPollText(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "?" || text === "…" || text === "..." ? "" : text;
}
