"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { withOwnerToken } from "@/lib/client/errors";
import {
  apiFailureMessage,
  readApiJson,
  showActionError,
  showActionLoading,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";
import { WidgetDispatcher } from "./widgets/WidgetDispatcher";
import { CellChromeContext } from "./widgets/cellChrome";
import { WidgetPickerContent } from "./WidgetPicker";
import { RenderBoundary } from "./ui/RenderBoundary";

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
 * in a CSS grid masonry. Every element keeps the same single-column
 * cell width on desktop; temporary fullscreen belongs to specialised
 * widgets such as Moodboard, not to the grid chrome.
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
  modulesRev,
  onRefresh,
}: {
  bodyItems: BodyItem[];
  stateByModule: Map<number, ModuleStateEntry[]>;
  headerModules: Module[];
  spaceId: string;
  ownerToken: string | null;
  isOwner: boolean;
  labels: { emptyGrid?: string; emptyGridHint?: string };
  modulesRev: number;
  onRefresh: () => void;
}) {
  // Optimistic reorder: on drop we render the new order immediately and
  // only fall back to the server's order once the refetch confirms it.
  // Without this the dropped item snapped back to its old slot (props
  // hadn't changed yet) and the real order then appeared abruptly after
  // the round-trip, with no transition.
  const [optimisticItems, setOptimisticItems] = useState<BodyItem[] | null>(null);
  // Order is tracked by module IDENTITY, not by position: a reorder swaps which
  // module sits at each index but the index set stays {3,4,5,…}, so a
  // position-based key never changes.
  //
  // We DERIVE whether the optimistic override is still ahead of the server,
  // rather than clearing it in an effect. An effect fires one render late — and
  // in that render the new server order (bodyItems) is live while the stale
  // optimistic items, whose indices no longer match the freshly re-associated
  // state, are still shown; the widget's module_id guard then blanks the
  // swapped elements for a frame (the brief flash). Deriving switches back to
  // server truth in the SAME render the new order arrives — no flash.
  const serverOrderKey = bodyItems.map((it) => it.module.id ?? it.index).join(",");
  const optimisticOrderKey = optimisticItems?.map((it) => it.module.id ?? it.index).join(",") ?? null;
  const items = optimisticItems && optimisticOrderKey !== serverOrderKey ? optimisticItems : bodyItems;
  useEffect(() => {
    // Once the server order matches, drop the now-unused override so the next
    // drag starts clean. The render already ignores it, so this can lag safely.
    if (optimisticItems && optimisticOrderKey === serverOrderKey) setOptimisticItems(null);
  }, [optimisticItems, optimisticOrderKey, serverOrderKey]);

  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addError, setAddError] = useState("");

  const sensors = useSensors(
    // A small distance threshold means a click on the grip that doesn't
    // move won't be read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const body = (m: Record<string, unknown>) => JSON.stringify(withOwnerToken(m, ownerToken));

  // ── Reorder ─────────────────────────────────────────────────────
  async function commitOrder(next: BodyItem[]) {
    setBusy(true);
    try {
      const modules = [...headerModules, ...next.map((it) => it.module)];
      // `order[newPosition] = oldIndex` — lets the server remap module_state
      // (keyed by positional index) so collaborative rows follow their widget
      // instead of orphaning onto whatever slides into the slot. Header
      // modules don't reorder, so they map to themselves.
      const order = [
        ...headerModules.map((_, i) => i),
        ...next.map((it) => it.index),
      ];
      const res = await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: body({ modules, order, modulesRev }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        throw new Error(apiFailureMessage(json, "Die neue Element-Reihenfolge konnte nicht gespeichert werden."));
      }
      onRefresh();
    } catch (error) {
      setOptimisticItems(null);
      showUnknownError("Reihenfolge nicht gespeichert", error, {
          fallback: "Die neue Element-Reihenfolge konnte nicht gespeichert werden.",
      });
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
      showActionLoading("Element wird entfernt …", `remove-${spaceId}-${target.index}`);
      const res = await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: body({ index: target.index, modulesRev }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        showApiError("Element nicht entfernt", json, {
          id: `remove-${spaceId}-${target.index}`,
          fallback: "Dieses Element konnte nicht entfernt werden.",
        });
        return;
      }
      showActionSuccess("Element entfernt", { id: `remove-${spaceId}-${target.index}` });
      onRefresh();
    } catch (error) {
      showUnknownError("Element nicht entfernt", error, {
        id: `remove-${spaceId}-${target.index}`,
        fallback: "Dieses Element konnte nicht entfernt werden.",
      });
    } finally {
      setBusy(false);
    }
  }

  // ── Add (optimistic) ────────────────────────────────────────────
  async function addWidget(widget: Module) {
    setPickerOpen(false);
    setAddError("");
    const previous = optimisticItems;
    const visible = optimisticItems ?? bodyItems;
    const optimisticIndex = headerModules.length + visible.length;
    setOptimisticItems([...visible, { module: widget, index: optimisticIndex }]);
    setBusy(true);
    try {
      showActionLoading("Element wird hinzugefügt …", `add-${spaceId}`);
      const res = await fetch(`/api/spaces/${spaceId}/widgets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body({ widget, modulesRev }),
      });
      const json = await readApiJson(res) as { index?: number; modulesRev?: number };
      if (!res.ok) {
        throw new Error(apiFailureMessage(json, "Element konnte nicht hinzugefügt werden."));
      }
      const realIndex = typeof json.index === "number" ? json.index : null;
      if (realIndex !== null && realIndex !== optimisticIndex) {
        setOptimisticItems((current) => current
          ? current.map((it) => (it.index === optimisticIndex ? { ...it, index: realIndex } : it))
          : current);
      }
      // Manual adds of AI-authorable widgets should NOT keep their dumb
      // placeholder (e.g. icon = star). Author it from space context.
      if (realIndex !== null && AI_FILL_ON_ADD.has(widget.type)) {
        const nextModulesRev = typeof json.modulesRev === "number" ? json.modulesRev : modulesRev + 1;
        await fillFromContext(realIndex, nextModulesRev);
      }
      showActionSuccess("Element hinzugefügt", { id: `add-${spaceId}` });
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Element konnte nicht hinzugefügt werden.";
      setOptimisticItems(previous);
      setAddError(message);
      showActionError("Element nicht hinzugefügt", {
        id: `add-${spaceId}`,
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  /** Run regenerate (count:1) for a freshly-added widget and persist
   *  the AI's choice, so a manual add lands as a fitting widget rather
   *  than a generic default. Best-effort — silent on failure. */
  async function fillFromContext(realIndex: number, expectedModulesRev: number) {
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
          body: body({ widget: picked, modulesRev: expectedModulesRev }),
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
        background: "var(--v-grid)",
        border: "1px solid var(--v-rule)",
        boxShadow: "var(--v-grid-shadow)",
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
            backgroundImage: "radial-gradient(circle, var(--v-grid-dot) 1px, transparent 1.4px)",
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
                error={addError}
                onToggle={() => setPickerOpen((v) => !v)}
                onClose={() => setPickerOpen(false)}
                onPick={addWidget}
              />
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
                  className="grid grid-cols-1 sm:grid-cols-2 items-start"
                  style={{
                    gridAutoRows: `${MASONRY_ROW_PX}px`,
                    gridAutoFlow: "row dense",
                    // Column gap is real; row spacing is baked into each
                    // cell's rowSpan (a fixed block of empty rows) so the
                    // vertical gap is constant instead of varying with the
                    // 1px-row/12px-gap quantization slack.
                    columnGap: `${MASONRY_GAP_PX}px`,
                    rowGap: 0,
                  }}
                >
                  {items.map((item) => (
                    <SortableCell
                      // Key on the stable module id so reordering preserves each
                      // widget's component instance (no remount → no content
                      // flashing away until reload). Falls back to index for
                      // any pre-id module.
                      key={item.module.id ?? `${item.index}::${item.module.type}`}
                      item={item}
                      stateEntries={stateByModule.get(item.index) ?? []}
                      isOwner={isOwner}
                      busy={busy}
                      onRemove={() => removeAt(item.index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {isOwner && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <AddButton
                  open={pickerOpen}
                  busy={busy}
                  error={addError}
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
 * A single draggable, removable widget cell. Drag is
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
  busy,
  onRemove,
}: {
  item: BodyItem;
  stateEntries: ModuleStateEntry[];
  isOwner: boolean;
  busy: boolean;
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
      // Rows are 1px with no row-gap, so the cell's own height needs
      // ceil(height) rows; add a fixed block for a constant vertical gap.
      const next = Math.max(
        1,
        Math.ceil(height / MASONRY_ROW_PX) + MASONRY_GAP_PX,
      );
      setRowSpan((prev) => (prev === next ? prev : next));
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.index]);

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
        gridRow: `span ${rowSpan}`,
        borderRadius: "var(--v-radius)",
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: "relative",
      }}
    >
      {/* Reorder / remove are handed to WidgetShell via context
          so the widget renders ONE toolbar (cell chrome + its own
          regenerate/prompt affordances), not two floating clusters. */}
      {isOwner ? (
        <CellChromeContext.Provider
          value={{ attributes, listeners, setActivatorNodeRef, onRemove, busy }}
        >
          <RenderBoundary label="Element" resetKeys={[item.index, item.module.type]}>
            <WidgetDispatcher module={item.module} index={item.index} state={stateEntries} />
          </RenderBoundary>
        </CellChromeContext.Provider>
      ) : (
        <RenderBoundary label="Element" resetKeys={[item.index, item.module.type]}>
          <WidgetDispatcher module={item.module} index={item.index} state={stateEntries} />
        </RenderBoundary>
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
  error,
  onToggle,
  onClose,
  onPick,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onToggle: () => void;
  onClose: () => void;
  onPick: (w: Module) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <motion.button
          type="button"
          disabled={busy}
          onClick={onToggle}
          aria-expanded={open}
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
        {error && (
          <div className="mono max-w-[280px] text-center text-[9px] tracking-widest opacity-70" style={{ color: "var(--v-fg)" }}>
            {error}
          </div>
        )}
      </div>
      <WidgetPickerOverlay
        open={open}
        onClose={onClose}
        onPick={(w) => {
          onPick(w);
          onClose();
        }}
      />
    </>
  );
}

function WidgetPickerOverlay({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (w: Module) => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [themeStyle, setThemeStyle] = useState<React.CSSProperties>({});
  const isMobile = useIsMobile();

  // Portal to <body>, NOT into .vibe-root: a transformed ancestor of the
  // workspace makes `position: fixed` anchor to that box instead of the
  // viewport, which turned the full-screen backdrop into a bounded grey
  // "vignette" (only clickable in its centre). Snapshot the vibe CSS vars so
  // the portaled picker keeps the project's theme.
  useEffect(() => {
    if (!open) return;
    setTarget(document.body);
    const root = document.querySelector(".vibe-root");
    if (!root) return;
    const cs = getComputedStyle(root);
    const style: Record<string, string> = {};
    for (const v of [
      "--v-accent", "--v-fg", "--v-page", "--v-bg", "--v-rule", "--v-muted",
      "--v-card", "--v-control", "--v-widget", "--v-widget-border", "--v-grid",
      "--v-grid-dot", "--v-grid-shadow", "--v-widget-shadow", "--v-radius",
      "--v-font", "--v-heading",
    ]) {
      const val = cs.getPropertyValue(v);
      if (val) style[v] = val.trim();
    }
    setThemeStyle(style as React.CSSProperties);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!target || !open) return null;

  return createPortal(
    <div style={themeStyle}>
      <motion.button
        type="button"
        aria-label="close widget picker"
        className="fixed inset-0 z-50 cursor-default"
        style={{ background: "rgba(0,0,0,0.42)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        onClick={onClose}
      />
      <div
        className={`fixed z-50 pointer-events-none ${isMobile ? "inset-x-0 bottom-0 p-3" : "inset-0 flex items-center justify-center p-5"}`}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="add widget"
          initial={{ opacity: 0, y: isMobile ? 28 : 10, scale: isMobile ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isMobile ? 28 : 10, scale: isMobile ? 1 : 0.97 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={`pointer-events-auto flex w-full flex-col overflow-hidden ${isMobile ? "rounded-t-[var(--v-radius)]" : "rounded-[var(--v-radius)]"}`}
          style={{
            maxWidth: isMobile ? undefined : 560,
            maxHeight: isMobile ? "82dvh" : "min(78dvh, 640px)",
            background: "var(--v-bg)",
            border: "1px solid var(--v-rule)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.36)",
          }}
        >
          <div
            className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--v-rule)" }}
          >
            <div className="mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--v-muted)" }}>
              Baustein hinzufügen
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="mono rounded-full px-2 py-1 text-[11px]"
              style={{ color: "var(--v-muted)", border: "1px solid var(--v-rule)" }}
            >
              ×
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <WidgetPickerContent onPick={onPick} />
          </div>
        </motion.div>
      </div>
    </div>,
    target,
  );
}
