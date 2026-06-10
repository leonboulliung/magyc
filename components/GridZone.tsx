"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Module, ModuleStateEntry } from "@/lib/types";
import { bodyContainer, bodyItem } from "@/lib/anim";
import { WidgetDispatcher } from "./widgets/WidgetDispatcher";
import { WidgetPicker } from "./WidgetPicker";

/**
 * GridZone — the body widget area of a space.
 *
 * State model (v2): the server is the source of truth. Props are
 * mirrored into `items` local state, re-synced whenever the prop set
 * changes (detected via a content signature). All mutations are
 * optimistic — the local list updates instantly, the server call
 * follows, and the next refresh reconciles. This is what makes
 * add / remove / reorder feel instant instead of laggy.
 *
 * Visual: a bounded surface with a faint crosshatch (graph-paper)
 * grid as an orientation aid. Owner affordances reveal on hover.
 */

export interface BodyItem {
  module: Module;
  /** Index in the full space.modules array — used by the dispatcher
   *  for state posting and widget PUT/regenerate calls. */
  index: number;
  stateEntries: ModuleStateEntry[];
}

/** Content signature — changes when the server set changes. */
function signatureOf(items: BodyItem[]): string {
  return items.map((it) => `${it.index}:${it.module.type}`).join("|");
}

export function GridZone({
  bodyItems,
  headerModules,
  spaceId,
  ownerToken,
  isOwner,
  labels,
  onRefresh,
}: {
  bodyItems: BodyItem[];
  headerModules: Module[];
  spaceId: string;
  ownerToken: string | null;
  isOwner: boolean;
  labels: { emptyGrid?: string; emptyGridHint?: string };
  onRefresh: () => void;
}) {
  // ── Mirror props into local state, synced by signature ──────────
  const [items, setItems] = useState<BodyItem[]>(bodyItems);
  const sig = signatureOf(bodyItems);
  const prevSig = useRef(sig);
  if (sig !== prevSig.current) {
    prevSig.current = sig;
    setItems(bodyItems);
  }

  const [fullWidth, setFullWidth] = useState<Set<number>>(new Set());
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const body = (m: Record<string, unknown>) => JSON.stringify({ ...m, anonOwnerToken: ownerToken });

  // ── Reorder (optimistic) ────────────────────────────────────────
  async function commitOrder(next: BodyItem[]) {
    setItems(next);
    setBusy(true);
    try {
      const modules = [...headerModules, ...next.map((it) => it.module)];
      await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: body({ modules }),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  // ── Remove (optimistic) ─────────────────────────────────────────
  async function removeAt(pos: number) {
    const target = items[pos];
    if (!target) return;
    const next = items.filter((_, i) => i !== pos);
    setItems(next);
    prevSig.current = signatureOf(next); // suppress resync flicker
    setBusy(true);
    try {
      await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: body({ index: target.index }),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  // ── Add (optimistic) ────────────────────────────────────────────
  async function addWidget(widget: Module) {
    setPickerOpen(false);
    // Optimistic placeholder with a temporary index past the current
    // max; the real index arrives on refresh.
    const tempIndex = headerModules.length + items.length + 1000;
    const optimistic: BodyItem = { module: widget, index: tempIndex, stateEntries: [] };
    const next = [...items, optimistic];
    setItems(next);
    prevSig.current = signatureOf(next);
    setBusy(true);
    try {
      await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body({ widget }),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  // ── Drag handlers ───────────────────────────────────────────────
  function handleDrop(pos: number) {
    if (dragFrom === null || dragFrom === pos) {
      setDragFrom(null); setDragOver(null);
      return;
    }
    const next = [...items];
    const moved = next.splice(dragFrom, 1)[0];
    next.splice(dragFrom < pos ? pos - 1 : pos, 0, moved);
    setDragFrom(null); setDragOver(null);
    commitOrder(next);
  }

  const isEmpty = items.length === 0;

  return (
    <div
      className="rounded-lg relative"
      style={{
        // The element grid is ALWAYS white with a black dot grid,
        // independent of the space's background color — a stable,
        // neutral canvas the colored widgets sit on.
        background: "#ffffff",
        border: "1px solid var(--v-rule)",
        minHeight: 240,
      }}
    >
      {/* Dot grid — a black dot at every 24px lattice point. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.18) 1px, transparent 1.4px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "12px 12px",
          }}
        />
      </div>

      <div className="relative p-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
            {labels.emptyGrid && (
              <p className="mono text-[10px] tracking-widest opacity-40 text-center" style={{ color: "var(--v-muted)" }}>
                {labels.emptyGrid}
              </p>
            )}
            {isOwner && (
              <AddButton
                open={pickerOpen}
                busy={busy}
                onToggle={() => setPickerOpen((v) => !v)}
                onClose={() => setPickerOpen(false)}
                onPick={addWidget}
              />
            )}
          </div>
        ) : (
          <>
            {/* Masonry via CSS multi-column: widgets size to their
                content and pack tightly with no measurement, no overlap,
                and the container grows to contain them automatically.
                Full-width widgets break out with column-span: all. */}
            <motion.div
              className="columns-1 sm:columns-2"
              style={{ columnGap: 12 }}
              variants={bodyContainer}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence initial={false}>
                {items.map((item, pos) => {
                  const isFull = fullWidth.has(item.index);
                  const isDragging = dragFrom === pos;
                  const isTarget = dragOver === pos;
                  return (
                    <motion.div
                      key={`${item.index}::${item.module.type}`}
                      variants={bodyItem}
                      animate={{ opacity: isDragging ? 0.35 : 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.18 }}
                      className="relative group/cell mb-3 break-inside-avoid"
                      style={{
                        columnSpan: isFull ? "all" : undefined,
                        outline: isTarget ? "2px dashed var(--v-fg)" : "none",
                        outlineOffset: 3,
                        borderRadius: 6,
                      }}
                      draggable={isOwner}
                      onDragStart={() => setDragFrom(pos)}
                      onDragOver={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== pos) setDragOver(pos); }}
                      onDrop={() => handleDrop(pos)}
                      onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                    >
                      <WidgetDispatcher
                        module={item.module}
                        index={item.index}
                        state={item.stateEntries}
                      />

                      {isOwner && (
                        <>
                          <div
                            className="absolute -top-0.5 -left-0.5 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-grab select-none"
                            style={{ color: "var(--v-muted)" }}
                          >
                            <span className="mono text-[12px] inline-block px-1 py-0.5 rounded-br" style={{ background: "var(--v-rule)", lineHeight: 1 }}>
                              ⠿
                            </span>
                          </div>
                          <div className="absolute -top-0.5 -right-0.5 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center gap-0.5">
                            <button
                              type="button"
                              title={isFull ? "half width" : "full width"}
                              onClick={() => setFullWidth((s) => {
                                const n = new Set(s);
                                if (n.has(item.index)) n.delete(item.index); else n.add(item.index);
                                return n;
                              })}
                              className="mono text-[11px] px-1.5 py-0.5 rounded-bl"
                              style={{ background: "var(--v-rule)", color: "var(--v-muted)", lineHeight: 1 }}
                            >
                              {isFull ? "⇒" : "⇔"}
                            </button>
                            <button
                              type="button"
                              title="remove"
                              onClick={() => removeAt(pos)}
                              disabled={busy}
                              className="mono text-[11px] px-1.5 py-0.5 rounded-bl disabled:opacity-30"
                              style={{ background: "var(--v-rule)", color: "var(--v-muted)", lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {isOwner && (
              <div className="flex justify-center mt-4">
                <AddButton
                  open={pickerOpen}
                  busy={busy}
                  onToggle={() => setPickerOpen((v) => !v)}
                  onClose={() => setPickerOpen(false)}
                  onPick={addWidget}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The add-widget affordance. Self-contained relative anchor so the
 * picker panel is reliably positioned above the button and centered.
 */
function AddButton({
  open,
  busy,
  onToggle,
  onClose,
  onPick,
}: {
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (w: Module) => void;
}) {
  return (
    <div className="relative">
      <WidgetPicker open={open} onClose={onClose} onPick={onPick} />
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="mono text-[11px] tracking-widest px-5 py-2 rounded-full disabled:opacity-30"
        style={{
          border: `1px dashed ${open ? "var(--v-fg)" : "var(--v-rule)"}`,
          color: "var(--v-fg)",
          background: "var(--v-bg)",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {busy ? "…" : "+"}
      </motion.button>
    </div>
  );
}
