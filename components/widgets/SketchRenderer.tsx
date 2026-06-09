"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import { postState, getMyColor } from "@/lib/state";
import type { ModuleStateEntry, SketchWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Sketch — collaborative canvas. Each participant draws with their
 * personal profile color (from getMyColor()). Strokes are recorded
 * as `stroke` actions in module_state carrying:
 *   { path: SVG-path-string, color: hex, width: number }
 *
 * All strokes are replayed on a shared SVG canvas — every visitor
 * sees every collaborator's strokes in their color. No eraser yet
 * (Phase 8 scope is draw-only). Drawing is pointer-event based so
 * it works on touch devices.
 *
 * The SVG viewBox is fixed at 800×500 but the element scales to fill
 * the widget width via `viewBox` + `preserveAspectRatio`. This keeps
 * path coordinates consistent across devices.
 *
 * Undo: removes the actor's LAST stroke from the server's state list.
 * Since we can't delete state rows directly, undo is client-local
 * (temporarily hides the last stroke) until the page refreshes.
 */
export function SketchRenderer({
  module: m,
  index,
  state,
}: {
  module: SketchWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const currentPath = useRef<string>("");
  const currentEl = useRef<SVGPathElement | null>(null);
  const [localUndo, setLocalUndo] = useState<Set<string>>(new Set());

  // All strokes from state, newest-last.
  const strokes = state
    .filter((e) => e.kind === "stroke" && typeof e.data.path === "string" && e.data.path)
    .sort((a, b) => a.createdAt - b.createdAt)
    .filter((e) => !localUndo.has(e.id));

  const myColor = getMyColor();

  // ── Pointer handlers ─────────────────────────────────────────────

  function svgPoint(e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 500 / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    const { x, y } = svgPoint(e);
    currentPath.current = `M${x} ${y}`;
    setDrawing(true);
    // Create a live path element for real-time feedback.
    const svg = svgRef.current!;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("stroke", myColor);
    el.setAttribute("stroke-width", "3");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    el.setAttribute("d", currentPath.current);
    svg.appendChild(el);
    currentEl.current = el;
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing) return;
    const { x, y } = svgPoint(e);
    currentPath.current += ` L${x} ${y}`;
    currentEl.current?.setAttribute("d", currentPath.current);
  }

  async function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing) return;
    setDrawing(false);
    (e.target as SVGElement).releasePointerCapture(e.pointerId);
    // Remove the live element — it'll be replaced by the state replay.
    currentEl.current?.remove();
    currentEl.current = null;
    const path = currentPath.current;
    currentPath.current = "";
    if (!path || path.length < 8) return; // too short to save
    await postState(ctx.spaceId, index, "stroke", { path, color: myColor, width: 3 });
    ctx.refresh();
  }

  // ── Local undo (newest stroke of current actor) ──────────────────
  function undo() {
    // Find my most recent non-undone stroke.
    const myId = typeof window !== "undefined" ? (localStorage.getItem("ccp-anon-token") || "") : "";
    const mine = strokes
      .filter((e) => e.actor.id === myId)
      .map((e) => e.id);
    if (mine.length === 0) return;
    const last = mine[mine.length - 1];
    setLocalUndo((s) => new Set([...s, last]));
  }

  // Clear canvas override (owner-only).
  // We can't delete state rows, so this is visual-only until refresh.
  const [cleared, setCleared] = useState(false);
  function clearAll() {
    if (!ctx.isOwner) return;
    setLocalUndo(new Set(state.filter((e) => e.kind === "stroke").map((e) => e.id)));
    setCleared(true);
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {/* Canvas */}
        <div
          className="relative overflow-hidden"
          style={{ background: "var(--v-bg)", borderRadius: "inherit" }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 800 500"
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            style={{ display: "block", touchAction: "none", cursor: drawing ? "crosshair" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {!cleared && strokes.map((e) => (
              <path
                key={e.id}
                d={String(e.data.path)}
                stroke={typeof e.data.color === "string" ? (e.data.color as string) : "#888"}
                strokeWidth={typeof e.data.width === "number" ? (e.data.width as number) : 3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {strokes.length === 0 && !drawing && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="mono text-[11px] tracking-widest opacity-30" style={{ color: "var(--v-muted)" }}>
                {m.placeholder ?? "○"}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Color swatch */}
          <span
            className="inline-block rounded-full shrink-0"
            style={{ width: 10, height: 10, background: myColor }}
          />
          <div className="flex-1" />
          {strokes.length > 0 && (
            <button
              type="button"
              onClick={undo}
              className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100"
              style={{ color: "var(--v-fg)" }}
              title="undo last stroke"
            >
              ↩
            </button>
          )}
          {ctx.isOwner && strokes.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="mono text-[10px] tracking-widest opacity-40 hover:opacity-100"
              style={{ color: "var(--v-fg)" }}
              title="clear canvas"
            >
              ×
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
