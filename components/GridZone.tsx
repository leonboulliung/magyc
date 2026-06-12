"use client";

import { useState, useRef } from "react";
import { motion } from "motion/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Module, ModuleStateEntry } from "@/lib/types";
import { WidgetDispatcher } from "./widgets/WidgetDispatcher";
import { WidgetPickerContent } from "./WidgetPicker";
import { Popover } from "./ui/Popover";

/**
 * GridZone — the body widget area of a space.
 *
 * State model: the server is the source of truth. Props are mirrored
 * into `items` local state, re-synced whenever the prop set changes
 * (detected via a content signature). All mutations are optimistic —
 * the local list updates instantly, the server call follows, and the
 * next refresh reconciles.
 *
 * Reorder is powered by @dnd-kit/sortable, dragged ONLY from each
 * cell's grip handle so it never fights the widget's own interactions
 * (a map pan, a poll tap) and the dragged node stays mounted (no map
 * re-init). Keyboard drag + screen-reader announcements come for free.
 *
 * Visual: a bounded white surface with a faint dot grid; widgets pack
 * in a CSS multi-column masonry, half- or full-width per cell.
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

/** Widget types whose manual add should be AI-authored from space
 *  context instead of keeping a generic placeholder (icon = star). */
const AI_FILL_ON_ADD: ReadonlySet<string> = new Set(["icon"]);

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
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(
    // A small distance threshold means a click on the grip that doesn't
    // move won't be read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => String(it.index) === active.id);
    const newIndex = items.findIndex((it) => String(it.index) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commitOrder(arrayMove(items, oldIndex, newIndex));
  }

  // ── Remove (optimistic) ─────────────────────────────────────────
  async function removeAt(targetIndex: number) {
    const target = items.find((it) => it.index === targetIndex);
    if (!target) return;
    const next = items.filter((it) => it.index !== targetIndex);
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

  function toggleFull(targetIndex: number) {
    setFullWidth((s) => {
      const n = new Set(s);
      if (n.has(targetIndex)) n.delete(targetIndex); else n.add(targetIndex);
      return n;
    });
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
      const res = await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body({ widget }),
      });
      const json = await res.json().catch(() => ({} as { index?: number }));
      const realIndex = typeof json.index === "number" ? json.index : null;
      // Manual adds of AI-authorable widgets should NOT keep their dumb
      // placeholder (e.g. icon = star). Author it from space context.
      if (realIndex !== null && AI_FILL_ON_ADD.has(widget.type)) {
        await fillFromContext(realIndex);
      }
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  /** Run regenerate (count:1) for a freshly-added widget and persist
   *  the AI's choice, so a manual add lands as a fitting widget rather
   *  than a generic default. Best-effort — silent on failure. */
  async function fillFromContext(realIndex: number) {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/widgets/${realIndex}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: 1, anonToken: ownerToken }),
      });
      const json = await res.json().catch(() => ({} as { suggestions?: Module[] }));
      const picked = Array.isArray(json.suggestions) ? json.suggestions[0] : null;
      if (picked) {
        await fetch(`/api/spaces/${spaceId}/widgets/${realIndex}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: body({ widget: picked }),
        });
      }
    } catch {
      // leave the placeholder; the owner can still ⇆ for alternatives
    }
  }

  const isEmpty = items.length === 0;

  return (
    <div
      className="rounded-lg relative"
      style={{
        // Always white with a dot grid, independent of the space's
        // background — a stable neutral canvas the coloured widgets sit on.
        background: "#ffffff",
        border: "1px solid var(--v-rule)",
        minHeight: 240,
      }}
    >
      {/* Dot grid — a dot at every 24px lattice point. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1px, transparent 1.4px)",
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
              <AddButton open={pickerOpen} busy={busy} onToggle={() => setPickerOpen((v) => !v)} onClose={() => setPickerOpen(false)} onPick={addWidget} />
            )}
          </div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((it) => String(it.index))} strategy={rectSortingStrategy}>
                <div className="columns-1 sm:columns-2" style={{ columnGap: 12 }}>
                  {items.map((item) => (
                    <SortableCell
                      key={`${item.index}::${item.module.type}`}
                      item={item}
                      isOwner={isOwner}
                      isFull={fullWidth.has(item.index)}
                      busy={busy}
                      onToggleFull={() => toggleFull(item.index)}
                      onRemove={() => removeAt(item.index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {isOwner && (
              <div className="flex justify-center mt-4">
                <AddButton open={pickerOpen} busy={busy} onToggle={() => setPickerOpen((v) => !v)} onClose={() => setPickerOpen(false)} onPick={addWidget} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A single draggable, removable, full/half-width widget cell. Drag is
 * initiated only from the grip handle (setActivatorNodeRef + listeners),
 * leaving the rest of the card free for the widget's own interactions.
 */
function SortableCell({
  item,
  isOwner,
  isFull,
  busy,
  onToggleFull,
  onRemove,
}: {
  item: BodyItem;
  isOwner: boolean;
  isFull: boolean;
  busy: boolean;
  onToggleFull: () => void;
  onRemove: () => void;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(item.index), disabled: !isOwner });

  return (
    <div
      ref={setNodeRef}
      className="relative group/cell mb-3"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        columnSpan: isFull ? "all" : undefined,
        breakInside: "avoid",
        borderRadius: 6,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: "relative",
      }}
    >
      <WidgetDispatcher module={item.module} index={item.index} state={item.stateEntries} />

      {isOwner && (
        <>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="reorder"
            className="absolute -top-0.5 -left-0.5 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity select-none"
            style={{ cursor: "grab", touchAction: "none", color: "var(--v-muted)", background: "transparent", border: "none", padding: 0 }}
          >
            <span className="mono text-[12px] inline-block px-1 py-0.5 rounded-br" style={{ background: "var(--v-rule)", lineHeight: 1 }}>
              ⠿
            </span>
          </button>
          <div className="absolute -top-0.5 -right-0.5 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center gap-0.5">
            <button
              type="button"
              title={isFull ? "half width" : "full width"}
              onClick={onToggleFull}
              className="mono text-[11px] px-1.5 py-0.5 rounded-bl"
              style={{ background: "var(--v-rule)", color: "var(--v-muted)", lineHeight: 1 }}
            >
              {isFull ? "⇒" : "⇔"}
            </button>
            <button
              type="button"
              title="remove"
              onClick={onRemove}
              disabled={busy}
              className="mono text-[11px] px-1.5 py-0.5 rounded-bl disabled:opacity-30"
              style={{ background: "var(--v-rule)", color: "var(--v-muted)", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </>
      )}
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
    <Popover
      open={open}
      onOpenChange={(o) => (o ? onToggle() : onClose())}
      side="top"
      sideOffset={8}
      trigger={
        <motion.button
          type="button"
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
      }
    >
      <WidgetPickerContent
        onPick={(w) => { onPick(w); onClose(); }}
      />
    </Popover>
  );
}
