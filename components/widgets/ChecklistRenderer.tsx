"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import { getSelfId } from "@/lib/state";
import type { ChecklistWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Checkliste — infinite-scroll checkable list.
 *
 * Seed items live on the widget config. Anyone can add more via `add`
 * actions. Each toggle is a `check` action carrying { itemKey, checked }
 * where itemKey is `seed-${i}` for AI-seeded items or the add action's id
 * for collaborator-added ones. The checked box is filled with the
 * checker's profile color (per CSV: "das Erledigt-Feld füllt sich mit
 * dem Profilbild des jeweiligen Nutzers").
 */
export function ChecklistRenderer({
  module: m,
  index,
  state,
}: {
  module: ChecklistWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const presetMode = ctx.mode === "preset";

  // Soft-deleted entries (collaborator adds tombstoned via an `edit`).
  const deleted = new Set(
    state
      .filter((e) => e.kind === "edit" && e.data.deleted === true && typeof e.data.id === "string")
      .map((e) => e.data.id as string),
  );

  // Reconstruct items — seed first (in original order), then collab adds.
  const added = state
    .filter((e) => e.kind === "add")
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      text: String(e.data.text ?? ""),
    }))
    .filter((it) => it.text && !deleted.has(it.key));

  const items = [
    ...m.items.map((it, i) => ({ key: `seed-${i}`, text: it.text })).filter((it) => !deleted.has(it.key)),
    ...added,
  ];

  // Build per-item check map. Last write per (actor, item) wins, but we
  // keep ALL checkers for the avatar pile.
  const checksByItem = new Map<string, { actorId: string; color?: string; name?: string }[]>();
  // Track per-actor latest state per item so we don't double-count.
  const latestPerActorItem = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "check") continue;
    const itemKey = typeof e.data.itemKey === "string" ? e.data.itemKey : null;
    if (!itemKey) continue;
    const k = `${e.actor.id}::${itemKey}`;
    latestPerActorItem.set(k, e);
  }
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
    const checkers = checksByItem.get(itemKey) || [];
    return checkers.some((c) => c.actorId === myId);
  }

  async function toggle(itemKey: string) {
    if (presetMode) return;
    const next = !isMine(itemKey);
    await ctx.act(index, "check", { itemKey, checked: next });
  }

  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    const v = pending.trim();
    setPending("");
    setAdding(false);
    if (!v) return;
    await ctx.act(index, "add", { text: v });
  }

  async function deleteItem(key: string) {
    // Tombstone seed + collaborator entries alike. Splicing a seed item out of
    // config would shift later seed-N indices, so check/edit state keyed to
    // those positions would attach to the wrong item.
    await ctx.act(index, "edit", { id: key, deleted: true });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "checklist" ? (
          <ul className="text-[12px] leading-snug list-disc pl-4 opacity-80">
            {s.items.slice(0, 4).map((it, i) => (
              <li key={i} className="truncate">{it.text}</li>
            ))}
          </ul>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const checkers = checksByItem.get(it.key) || [];
              const checked = checkers.length > 0;
              return (
                <motion.li
                  key={it.key}
                  layout
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 3 }}
                  transition={{ duration: 0.15 }}
                  className="group flex items-center gap-2.5"
                >
                  {!presetMode && (
                    <CheckBox
                      checked={checked}
                      checkers={checkers}
                      onClick={() => toggle(it.key)}
                    />
                  )}
                  <span
                    className={`text-[13px] flex-1 select-none ${presetMode ? "cursor-default" : "cursor-pointer"}`}
                    style={{
                      color: checked ? "var(--v-muted)" : "var(--v-fg)",
                      textDecoration: checked ? "line-through" : "none",
                      textDecorationColor: "var(--v-muted)",
                    }}
                    onClick={() => toggle(it.key)}
                  >
                    {it.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteItem(it.key)}
                    aria-label="Eintrag entfernen"
                    className="reveal-on-hover mono shrink-0 rounded-full px-1.5 text-[13px] leading-none"
                    style={{ color: "var(--v-muted)" }}
                  >
                    ×
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

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
              placeholder={tr.elements.addChecklistItem}
              className="w-full text-[13px] bg-transparent outline-none px-2 py-1 rounded-[var(--v-radius)]"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label={tr.elements.addChecklistItem}
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              + Eintrag hinzufügen
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function CheckBox({
  checked,
  checkers,
  onClick,
  disabled = false,
}: {
  checked: boolean;
  checkers: { actorId: string; color?: string; name?: string }[];
  onClick: () => void;
  disabled?: boolean;
}) {
  // When checked, fill the box with the first checker's color and
  // pile additional checkers as dots to the right (handled by parent).
  const primary = checkers[0];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={checked ? "uncheck" : "check"}
      className="shrink-0 inline-flex items-center justify-center rounded-sm transition-all"
      style={{
        width: 18,
        height: 18,
        border: "1.5px solid var(--v-rule)",
        background: checked && primary ? (primary.color || "var(--v-fg)") : "transparent",
        borderColor: checked && primary ? (primary.color || "var(--v-fg)") : "var(--v-rule)",
      }}
      title={checkers.map((c) => c.name).filter(Boolean).join(" · ")}
    >
      {checked && (
        <span
          className="mono text-[11px] leading-none"
          style={{ color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.2)" }}
        >
          ✓
        </span>
      )}
      {checkers.length > 1 && (
        <span
          className="ml-1 mono text-[9px] tabular-nums"
          style={{ color: "var(--v-muted)" }}
        >
          +{checkers.length - 1}
        </span>
      )}
    </button>
  );
}
