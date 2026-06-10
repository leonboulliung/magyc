"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Module, ModuleStateEntry } from "@/lib/types";
import { bodyContainer, bodyItem } from "@/lib/anim";
import { WidgetDispatcher } from "./widgets/WidgetDispatcher";
import { WidgetPicker } from "./WidgetPicker";

/**
 * GridZone — the body widget area of a space.
 *
 * Visual: a bounded, lightly-tinted surface with a hairline rule
 * border so the workspace area is unmistakably distinct from the
 * page chrome.  A faint column guide (12-col) is always visible at
 * very low opacity as an orientation aid.
 *
 * Owner affordances (hover-reveal):
 *   ⠿  drag handle (top-left) — HTML5 drag-to-reorder
 *   ⇔/⇒  width toggle (top-right) — half ↔ full width
 *   ×  remove (top-right)
 *   +  add widget (bottom) — opens WidgetPicker
 *
 * API: PATCH /api/spaces/[id]/widgets (reorder), DELETE (remove),
 *      POST (add).
 */

export interface BodyItem {
  module: Module;
  /** Original index in the full displayedModules array. */
  index: number;
  stateEntries: ModuleStateEntry[];
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
  /** Header-zone modules (heading, rich_text, tags) — kept at the
   *  front of the array when reordering body widgets. */
  headerModules: Module[];
  spaceId: string;
  ownerToken: string | null;
  isOwner: boolean;
  labels: { emptyGrid?: string; emptyGridHint?: string };
  onRefresh: () => void;
}) {
  // ── Local display order ──────────────────────────────────────
  // Tracks which bodyItem (by its position in the prop array) goes
  // at each position in the visual grid.
  const [order, setOrder] = useState<number[]>(() =>
    bodyItems.map((_, i) => i),
  );
  // Reset when bodyItems changes after a server refresh.
  const bodyLen = useRef(bodyItems.length);
  if (bodyItems.length !== bodyLen.current) {
    bodyLen.current = bodyItems.length;
    setOrder(bodyItems.map((_, i) => i));
  }

  // ── Widths (local only, not persisted) ───────────────────────
  const [fullWidth, setFullWidth] = useState<Set<number>>(new Set());

  // ── Drag state ───────────────────────────────────────────────
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // ── Saving indicator ─────────────────────────────────────────
  const [busy, setBusy] = useState(false);

  // ── Picker ───────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────
  const authBody = useCallback(
    () => ({ anonOwnerToken: ownerToken }),
    [ownerToken],
  );

  async function patchOrder(newOrder: number[]) {
    setBusy(true);
    try {
      const full = [
        ...headerModules,
        ...newOrder.map((i) => bodyItems[i].module),
      ];
      const res = await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules: full, ...authBody() }),
      });
      if (res.ok) onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeAt(orderPos: number) {
    const globalIdx = bodyItems[order[orderPos]].index;
    // Optimistic: remove from local order immediately so the UI
    // responds at once, then sync to server.
    const newOrder = order.filter((_, pos) => pos !== orderPos);
    setOrder(newOrder);
    bodyLen.current = newOrder.length; // prevent reset on next render
    setBusy(true);
    try {
      await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ index: globalIdx, ...authBody() }),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function addWidget(widget: Module) {
    setBusy(true);
    try {
      await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ widget, ...authBody() }),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  // ── Drag event handlers ───────────────────────────────────────
  function handleDragStart(pos: number) {
    setDragFrom(pos);
  }

  function handleDragOver(e: React.DragEvent, pos: number) {
    e.preventDefault();
    if (dragFrom !== null && dragFrom !== pos) setDragOver(pos);
  }

  function handleDrop(pos: number) {
    if (dragFrom === null || dragFrom === pos) {
      setDragFrom(null);
      setDragOver(null);
      return;
    }
    const o = [...order];
    const item = o.splice(dragFrom, 1)[0];
    o.splice(dragFrom < pos ? pos - 1 : pos, 0, item);
    setOrder(o);
    setDragFrom(null);
    setDragOver(null);
    patchOrder(o);
  }

  // ── Render ────────────────────────────────────────────────────
  const displayed = order.map((i) => bodyItems[i]).filter(Boolean);
  const isEmpty = displayed.length === 0;

  return (
    <div
      className="rounded-lg relative"
      style={{
        background: "var(--v-bg)",
        border: "1px solid var(--v-rule)",
        minHeight: 240,
      }}
    >
      {/* Crosshatch grid — dots at every column × row intersection.
          Horizontal pitch: 1/12 of the container width.
          Vertical pitch:   28px (matches typical line-height rhythm).
          The dot is a tiny radial gradient so it reads as "+" without
          being heavy. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
        style={{ opacity: 0.07 }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: [
              // Vertical column lines
              "repeating-linear-gradient(to right, var(--v-fg) 0, var(--v-fg) 1px, transparent 1px, transparent calc(100% / 12))",
              // Horizontal row lines — 28px pitch
              "repeating-linear-gradient(to bottom, var(--v-fg) 0, var(--v-fg) 1px, transparent 1px, transparent 28px)",
            ].join(", "),
          }}
        />
      </div>

      {/* Content */}
      <div className="relative p-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
            {labels.emptyGrid && (
              <p className="mono text-[10px] tracking-widest opacity-40 text-center" style={{ color: "var(--v-muted)" }}>
                {labels.emptyGrid}
              </p>
            )}
            {isOwner && (
              <div className="relative">
                <WidgetPicker
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onPick={(w) => { setPickerOpen(false); addWidget(w); }}
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={busy}
                  className="mono text-[10px] tracking-widest px-5 py-2 rounded-full disabled:opacity-30"
                  style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
                >
                  {busy ? "…" : "+"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-12 gap-3"
              variants={bodyContainer}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence initial={false}>
                {displayed.map((item, pos) => {
                  const isFull = fullWidth.has(pos);
                  const isDragging = dragFrom === pos;
                  const isTarget = dragOver === pos;
                  return (
                    <motion.div
                      key={`${item.index}::${item.module.type}`}
                      layout
                      variants={bodyItem}
                      animate={{ opacity: isDragging ? 0.35 : 1, scale: isDragging ? 0.97 : 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.18 }}
                      /* Tailwind purge-safe: use conditional, not dynamic interpolation */
                      className={`relative group/cell ${isFull ? "col-span-12" : "col-span-12 sm:col-span-6"}`}
                      style={{
                        outline: isTarget ? "2px dashed var(--v-fg)" : "none",
                        outlineOffset: 3,
                        borderRadius: 6,
                        cursor: isOwner ? "default" : undefined,
                      }}
                      draggable={isOwner}
                      onDragStart={() => handleDragStart(pos)}
                      onDragOver={(e) => handleDragOver(e, pos)}
                      onDrop={() => handleDrop(pos)}
                      onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                    >
                      {/* Widget itself */}
                      <WidgetDispatcher
                        module={item.module}
                        index={item.index}
                        state={item.stateEntries}
                      />

                      {/* Owner overlay controls */}
                      {isOwner && (
                        <>
                          {/* Drag handle */}
                          <div
                            className="absolute -top-0.5 -left-0.5 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-grab select-none"
                            style={{ color: "var(--v-muted)" }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <span
                              className="mono text-[12px] inline-block px-1 py-0.5 rounded-br"
                              style={{ background: "var(--v-rule)", lineHeight: 1 }}
                            >
                              ⠿
                            </span>
                          </div>

                          {/* Width + remove */}
                          <div className="absolute -top-0.5 -right-0.5 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center gap-0.5">
                            <button
                              type="button"
                              title={isFull ? "half width" : "full width"}
                              onClick={() =>
                                setFullWidth((s) => {
                                  const n = new Set(s);
                                  if (n.has(pos)) n.delete(pos); else n.add(pos);
                                  return n;
                                })
                              }
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

            {/* Add button */}
            {isOwner && (
              <div className="relative flex justify-center mt-4">
                <WidgetPicker
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onPick={(w) => { setPickerOpen(false); addWidget(w); }}
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  disabled={busy}
                  className="mono text-[10px] tracking-widest px-5 py-1.5 rounded-full transition-opacity disabled:opacity-30"
                  style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
                >
                  {busy ? "…" : "+"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
