"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
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
import { useIsMobile } from "@/lib/hooks";
import { WidgetDispatcher } from "./widgets/WidgetDispatcher";
import { CellChromeContext } from "./widgets/cellChrome";
import { WidgetPickerContent } from "./WidgetPicker";
import { Popover } from "./ui/Popover";
import { MobileSheet } from "./ui/MobileSheet";

/**
 * GridZone — the body widget area of a space.
 *
 * State model: the server is the source of truth. The grid renders
 * directly from the latest bodyItems props so widget content edits
 * never get stuck behind a stale local mirror. Add / remove / reorder
 * stay server-driven and reconcile on refresh.
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
}

/** Widget types whose manual add should be AI-authored from space
 *  context instead of keeping a generic placeholder (icon = star). */
const AI_FILL_ON_ADD: ReadonlySet<string> = new Set(["ai_summary"]);
const MASONRY_ROW_PX = 1;
const MASONRY_GAP_PX = 12;

export function GridZone({
  bodyItems,
  stateByModule,
  headerModules,
  spaceId,
  ownerToken,
  isOwner,
  labels,
  onRefresh,
}: {
  bodyItems: BodyItem[];
  stateByModule: Map<number, ModuleStateEntry[]>;
  headerModules: Module[];
  spaceId: string;
  ownerToken: string | null;
  isOwner: boolean;
  labels: { emptyGrid?: string; emptyGridHint?: string };
  onRefresh: () => void;
}) {
  // Optimistic reorder: on drop we render the new order immediately and
  // only fall back to the server's order once the refetch confirms it.
  // Without this the dropped item snapped back to its old slot (props
  // hadn't changed yet) and the real order then appeared abruptly after
  // the round-trip, with no transition.
  const [optimisticItems, setOptimisticItems] = useState<BodyItem[] | null>(null);
  const items = optimisticItems ?? bodyItems;
  const serverOrderKey = bodyItems.map((it) => it.index).join(",");
  useEffect(() => {
    // Server order caught up (or changed underneath us) → drop the override.
    setOptimisticItems(null);
  }, [serverOrderKey]);

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

  // ── Reorder ─────────────────────────────────────────────────────
  async function commitOrder(next: BodyItem[]) {
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
    const next = arrayMove(items, oldIndex, newIndex);
    setOptimisticItems(next); // show the new order instantly
    commitOrder(next);
  }

  // ── Remove (optimistic) ─────────────────────────────────────────
  async function removeAt(targetIndex: number) {
    const target = items.find((it) => it.index === targetIndex);
    if (!target) return;
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
      className="rounded-[var(--v-radius)] relative"
      style={{
        // A bounded glass surface with its own dot-grid layer, matching
        // the page-wide MAGYC field while keeping widgets legible.
        background: "rgba(255,255,255,0.028)",
        border: "1px solid var(--v-rule)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.24)",
        backdropFilter: "blur(18px)",
        minHeight: 240,
      }}
    >
      {/* Dot grid — a dot at every 24px lattice point. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[var(--v-radius)] overflow-hidden">
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1.4px)",
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
              <SortableContext items={items.map((it) => String(it.index))} strategy={rectSortingStrategy}>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start"
                  style={{
                    gridAutoRows: `${MASONRY_ROW_PX}px`,
                    gridAutoFlow: "row dense",
                  }}
                >
                  {items.map((item) => (
                    <SortableCell
                      key={`${item.index}::${item.module.type}`}
                      item={item}
                      stateEntries={stateByModule.get(item.index) ?? []}
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
 *
 * Each cell measures its own height and spans the corresponding number
 * of tiny auto-rows in the parent grid. That gives us masonry-style
 * packing while keeping grid placement and sortable behaviour intact.
 */
function SortableCell({
  item,
  stateEntries,
  isOwner,
  isFull,
  busy,
  onToggleFull,
  onRemove,
}: {
  item: BodyItem;
  stateEntries: ModuleStateEntry[];
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
  const localRef = useRef<HTMLDivElement | null>(null);
  const [rowSpan, setRowSpan] = useState(1);

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;

    const measure = () => {
      const height = el.getBoundingClientRect().height;
      const next = Math.max(
        1,
        Math.ceil((height + MASONRY_GAP_PX) / (MASONRY_ROW_PX + MASONRY_GAP_PX)),
      );
      setRowSpan((prev) => (prev === next ? prev : next));
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFull, item.index]);

  function attachRefs(node: HTMLDivElement | null) {
    localRef.current = node;
    setNodeRef(node);
  }

  return (
    <div
      ref={attachRefs}
      className="relative group/cell"
      style={{
        // Translate (not Transform): a sortable transform also carries
        // scaleX/scaleY to morph the dragged item into the target slot's
        // size — with variable-height widgets that squashes/stretches the
        // card (the reported "Verzerrung"). Translate keeps natural size.
        transform: CSS.Translate.toString(transform),
        transition,
        gridColumn: isFull ? "1 / -1" : undefined,
        gridRow: `span ${rowSpan}`,
        borderRadius: "var(--v-radius)",
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: "relative",
      }}
    >
      {/* Reorder / resize / remove are handed to WidgetShell via context
          so the widget renders ONE toolbar (cell chrome + its own
          regenerate/prompt affordances), not two floating clusters. */}
      {isOwner ? (
        <CellChromeContext.Provider
          value={{ attributes, listeners, setActivatorNodeRef, onRemove, onToggleFull, isFull, busy }}
        >
          <WidgetDispatcher module={item.module} index={item.index} state={stateEntries} />
        </CellChromeContext.Provider>
      ) : (
        <WidgetDispatcher module={item.module} index={item.index} state={stateEntries} />
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
  const isMobile = useIsMobile();

  // On phones the picker is a full-width bottom sheet (big tap targets,
  // dismiss on backdrop) instead of a popover anchored to a centered
  // button at the bottom of a long grid, which was awkward to reach.
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={onToggle}
          className="mono text-[11px] tracking-widest px-6 py-2.5 rounded-full disabled:opacity-30"
          style={{
            border: `1px dashed ${open ? "var(--v-fg)" : "var(--v-rule)"}`,
            color: "var(--v-fg)",
            background: open ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)",
          }}
        >
          {busy ? "…" : "+"}
        </button>
        <MobileSheet open={open} onClose={onClose} title="add widget">
          <WidgetPickerContent onPick={(w) => { onPick(w); onClose(); }} />
        </MobileSheet>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => (o ? onToggle() : onClose())}
      side="top"
      sideOffset={8}
      width="min(360px, calc(100vw - 24px))"
      contentStyle={{ maxHeight: "min(70vh, 460px)", overflowY: "auto" }}
      trigger={
        <motion.button
          type="button"
          disabled={busy}
          className="mono text-[11px] tracking-widest px-5 py-2 rounded-full disabled:opacity-30"
          style={{
            border: `1px dashed ${open ? "var(--v-fg)" : "var(--v-rule)"}`,
            color: "var(--v-fg)",
            background: open ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)",
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
