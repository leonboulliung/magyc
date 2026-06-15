"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { getSelfId } from "@/lib/state";
import type { ApprovalsWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

export function ApprovalsRenderer({
  module: m,
  index,
  state,
}: {
  module: ApprovalsWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  const added = state
    .filter((e) => e.kind === "add")
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      text: String(e.data.text ?? ""),
      description:
        typeof e.data.description === "string" ? (e.data.description as string) : undefined,
    }))
    .filter((item) => item.text);

  const items = [
    ...m.items.map((item, i) => ({ key: `seed-${i}`, text: item.text, description: item.description })),
    ...added,
  ];

  const latestPerActorItem = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "check") continue;
    const itemKey = typeof e.data.itemKey === "string" ? e.data.itemKey : null;
    if (!itemKey) continue;
    latestPerActorItem.set(`${e.actor.id}::${itemKey}`, e);
  }

  const checksByItem = new Map<string, { actorId: string; color?: string; name?: string }[]>();
  for (const [k, e] of latestPerActorItem.entries()) {
    if (!e.data.checked) continue;
    const itemKey = k.split("::")[1];
    const arr = checksByItem.get(itemKey) || [];
    arr.push({
      actorId: e.actor.id,
      color: typeof e.data.color === "string" ? e.data.color : undefined,
      name: e.actor.displayName,
    });
    checksByItem.set(itemKey, arr);
  }

  const myId = getSelfId();

  function isMine(itemKey: string): boolean {
    return (checksByItem.get(itemKey) || []).some((checker) => checker.actorId === myId);
  }

  async function toggle(itemKey: string) {
    await ctx.act(index, "check", { itemKey, checked: !isMine(itemKey) });
  }

  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    const value = pending.trim();
    setPending("");
    setAdding(false);
    if (!value) return;
    await ctx.act(index, "add", { text: value });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "approvals" ? (
          <ul className="text-[11px] leading-snug opacity-80 list-disc pl-4">
            {s.items.slice(0, 4).map((item, i) => (
              <li key={i} className="truncate">{item.text}</li>
            ))}
          </ul>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const checkers = checksByItem.get(item.key) || [];
              const approved = checkers.length > 0;
              const mine = isMine(item.key);
              return (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-[var(--v-radius)] p-3"
                  style={{
                    border: `1px solid ${approved ? "var(--v-fg)" : "var(--v-rule)"}`,
                    background: "rgba(255,255,255,0.65)",
                    boxShadow: approved
                      ? "0 1px 3px rgba(0,0,0,0.05)"
                      : "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(item.key)}
                      aria-label={mine ? "unapprove" : "approve"}
                      className="shrink-0 mt-0.5 inline-flex items-center justify-center transition-all"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "9999px",
                        border: `1.5px solid ${approved ? "var(--v-fg)" : "var(--v-rule)"}`,
                        background: approved ? "var(--v-fg)" : "transparent",
                      }}
                    >
                      {approved && (
                        <span className="mono text-[9px]" style={{ color: "var(--v-bg)" }}>
                          ✓
                        </span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
                        {item.text}
                      </div>
                      {item.description && (
                        <div className="text-[12px] leading-snug mt-0.5" style={{ color: "var(--v-muted)" }}>
                          {item.description}
                        </div>
                      )}
                      {checkers.length > 0 && (
                        <div className="flex -space-x-1.5 mt-2">
                          {checkers.slice(0, 6).map((checker) => (
                            <span
                              key={`${item.key}-${checker.actorId}`}
                              style={{ border: "1.5px solid var(--v-bg)", borderRadius: "9999px" }}
                            >
                              <ActorDot
                                color={checker.color}
                                displayName={checker.name}
                                size={18}
                              />
                            </span>
                          ))}
                          {checkers.length > 6 && (
                            <span className="mono text-[9px] tabular-nums ml-2 self-center" style={{ color: "var(--v-muted)" }}>
                              +{checkers.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-3">
          {adding ? (
            <input
              autoFocus
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={addItem}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addItem(); }
                else if (e.key === "Escape") { setPending(""); setAdding(false); }
              }}
              maxLength={200}
              placeholder="…"
              className="w-full text-[13px] bg-transparent outline-none px-2 py-1 rounded-[var(--v-radius)]"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="add"
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              +
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
