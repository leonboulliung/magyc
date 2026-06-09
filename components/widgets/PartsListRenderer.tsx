"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { postState } from "@/lib/state";
import type { ModuleStateEntry, PartsListWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

/**
 * Utensilien — parts list. Seed items live on the widget config;
 * collaborators add more via `add` actions in module_state.
 *
 * Each entry: name + optional quantity + optional image URL. Image
 * uploads land in Phase 6; for now the field accepts a pasted URL
 * (Wikimedia Commons direct links, product page images, etc.).
 */
export function PartsListRenderer({
  module: m,
  index,
  state,
}: {
  module: PartsListWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  // Collaborator-added items live in state.
  const added = state
    .filter((e) => e.kind === "add")
    .map((e) => ({
      key: e.id,
      name: String(e.data.name ?? ""),
      quantity: typeof e.data.quantity === "string" ? e.data.quantity : undefined,
      imageUrl: typeof e.data.imageUrl === "string" ? e.data.imageUrl : undefined,
      authorName: e.actor.displayName,
      authorColor: typeof e.data.color === "string" ? e.data.color : undefined,
      createdAt: e.createdAt,
    }))
    .filter((it) => it.name);

  interface Item {
    key: string;
    name: string;
    quantity?: string;
    imageUrl?: string;
    authorName?: string;
    authorColor?: string;
    createdAt?: number;
  }

  const seedItems: Item[] = m.items.map((it, i) => ({
    key: `seed-${i}`,
    name: it.name,
    quantity: it.quantity,
    imageUrl: it.imageUrl,
  }));

  const items: Item[] = [
    ...seedItems,
    ...added.sort((a, b) => a.createdAt - b.createdAt),
  ];

  const [pendingName, setPendingName] = useState("");
  const [pendingQty, setPendingQty] = useState("");
  const [pendingUrl, setPendingUrl] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    const name = pendingName.trim();
    if (!name) return;
    const qty = pendingQty.trim();
    const url = pendingUrl.trim();
    setPendingName("");
    setPendingQty("");
    setPendingUrl("");
    setAdding(false);
    await postState(ctx.spaceId, index, "add", {
      name,
      quantity: qty || undefined,
      imageUrl: url || undefined,
    });
    ctx.refresh();
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "parts_list" ? (
          <div className="text-[11px] opacity-70 truncate">
            {s.items.map((it) => it.name).join(" · ")}
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {items.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            …
          </p>
        )}

        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.key}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3"
              >
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.imageUrl}
                    alt={it.name}
                    width={36}
                    height={36}
                    className="rounded-sm object-cover shrink-0"
                    style={{ border: "1px solid var(--v-rule)" }}
                  />
                ) : (
                  <span
                    className="rounded-sm shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: "var(--v-rule)",
                      border: "1px solid var(--v-rule)",
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate" style={{ color: "var(--v-fg)" }}>
                    {it.name}
                  </div>
                  {it.quantity && (
                    <div className="mono text-[10px] opacity-60" style={{ color: "var(--v-muted)" }}>
                      {it.quantity}
                    </div>
                  )}
                </div>
                {it.authorName && (
                  <ActorDot color={it.authorColor} displayName={it.authorName} size={14} />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-3">
          {adding ? (
            <div className="space-y-1.5">
              <input
                autoFocus
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                placeholder="…"
                maxLength={120}
                className="w-full text-[13px] bg-transparent outline-none px-2 py-1 rounded-md"
                style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
              />
              <div className="flex gap-1.5">
                <input
                  value={pendingQty}
                  onChange={(e) => setPendingQty(e.target.value)}
                  placeholder="#"
                  maxLength={40}
                  className="flex-1 mono text-[11px] bg-transparent outline-none px-2 py-1 rounded-md"
                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                />
                <input
                  value={pendingUrl}
                  onChange={(e) => setPendingUrl(e.target.value)}
                  placeholder="https://…"
                  maxLength={500}
                  className="flex-[2] mono text-[11px] bg-transparent outline-none px-2 py-1 rounded-md"
                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                />
                <button
                  onClick={add}
                  disabled={!pendingName.trim()}
                  className="mono text-[10px] tracking-widest px-3 py-1 rounded-full disabled:opacity-30"
                  style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
                >
                  ↵
                </button>
                <button
                  onClick={() => { setAdding(false); setPendingName(""); setPendingQty(""); setPendingUrl(""); }}
                  className="mono text-[10px] tracking-widest px-2 opacity-60"
                  style={{ color: "var(--v-fg)" }}
                >
                  ×
                </button>
              </div>
            </div>
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
