"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import { getMyColor, getSelfId } from "@/lib/state";
import type { ModuleStateEntry, SketchWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Sketch — collaborative canvas with basic drawing tools.
 *
 * Each mark is a `stroke` action in module_state. The data shape is a
 * tagged union (back-compatible: a missing `type` is a freehand path):
 *   { type:"path",    path, color, width }      pen
 *   { type:"erase",   path, width }             eraser (paints bg)
 *   { type:"line",    x1,y1,x2,y2, color,width }
 *   { type:"rect",    x,y,w,h, color, width }
 *   { type:"ellipse", x,y,w,h, color, width }
 *   { type:"text",    x,y, text, color, size }
 *
 * Coordinates live in a fixed 800×500 viewBox so they stay consistent
 * across devices and the in-widget vs. full-screen editor. Drawing is
 * pointer-event based (mouse + touch); the live mark is manipulated
 * directly in the DOM so a long stroke doesn't thrash React.
 */

type Tool = "pen" | "eraser" | "line" | "rect" | "ellipse" | "text";

const VIEW_W = 800;
const VIEW_H = 500;
const PALETTE = ["#22272e", "#e5484d", "#f59e0b", "#16a34a", "#0ea5e9", "#a855f7", "#ec4899", "#ffffff"];
const SIZES = [2, 5, 11];

const SVGNS = "http://www.w3.org/2000/svg";

interface Stroke { id: string; data: Record<string, unknown> }

// ── Render one committed stroke ──────────────────────────────────────
function StrokeEl({ data }: { data: Record<string, unknown> }) {
  const type = typeof data.type === "string" ? data.type : "path";
  const color = typeof data.color === "string" ? data.color : "#888";
  const width = typeof data.width === "number" ? data.width : 3;
  const n = (v: unknown) => (typeof v === "number" ? v : 0);

  switch (type) {
    case "erase":
      return (
        <path d={String(data.path)} style={{ stroke: "var(--v-bg)" }} strokeWidth={width}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      );
    case "line":
      return <line x1={n(data.x1)} y1={n(data.y1)} x2={n(data.x2)} y2={n(data.y2)}
        stroke={color} strokeWidth={width} strokeLinecap="round" />;
    case "rect": {
      const w = n(data.w), h = n(data.h);
      return <rect x={Math.min(n(data.x), n(data.x) + w)} y={Math.min(n(data.y), n(data.y) + h)}
        width={Math.abs(w)} height={Math.abs(h)} rx={6} stroke={color} strokeWidth={width} fill="none" />;
    }
    case "ellipse": {
      const w = n(data.w), h = n(data.h);
      return <ellipse cx={n(data.x) + w / 2} cy={n(data.y) + h / 2} rx={Math.abs(w / 2)} ry={Math.abs(h / 2)}
        stroke={color} strokeWidth={width} fill="none" />;
    }
    case "text":
      return <text x={n(data.x)} y={n(data.y)} fill={color}
        fontSize={typeof data.size === "number" ? data.size : 24}
        style={{ fontFamily: "inherit", userSelect: "none" }}>{String(data.text)}</text>;
    default:
      return <path d={String(data.path)} stroke={color} strokeWidth={width}
        fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
}

// ── The drawing surface ──────────────────────────────────────────────
function SketchCanvas({
  strokes, tool, color, width, editable, onCommit, placeholder, className, style,
}: {
  strokes: Stroke[];
  tool: Tool;
  color: string;
  width: number;
  editable: boolean;
  onCommit: (data: Record<string, unknown>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const tr = useT();
  const gridId = `sketch-grid-${useId()}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const liveRef = useRef<SVGElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pathStr = useRef("");
  const [drawing, setDrawing] = useState(false);
  const [textAt, setTextAt] = useState<{ vx: number; vy: number; sx: number; sy: number } | null>(null);
  const [textVal, setTextVal] = useState("");

  function toView(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * (VIEW_W / rect.width)),
      y: Math.round((e.clientY - rect.top) * (VIEW_H / rect.height)),
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
    };
  }

  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (!editable || textAt) return;
    e.preventDefault();
    const p = toView(e);
    if (tool === "text") {
      setTextAt({ vx: p.x, vy: p.y, sx: p.sx, sy: p.sy });
      setTextVal("");
      return;
    }
    // Capture so the stroke keeps tracking outside the svg; never let a
    // capture failure abort the draw.
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    start.current = { x: p.x, y: p.y };
    setDrawing(true);
    const svg = svgRef.current!;
    let el: SVGElement;
    if (tool === "pen" || tool === "eraser") {
      pathStr.current = `M${p.x} ${p.y}`;
      el = document.createElementNS(SVGNS, "path");
      el.setAttribute("d", pathStr.current);
      el.setAttribute("fill", "none");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("stroke", tool === "eraser" ? "var(--v-bg)" : color);
      el.setAttribute("stroke-width", String(tool === "eraser" ? Math.max(width, 14) : width));
    } else if (tool === "line") {
      el = document.createElementNS(SVGNS, "line");
      for (const [k, v] of [["x1", p.x], ["y1", p.y], ["x2", p.x], ["y2", p.y]] as const) el.setAttribute(k, String(v));
      el.setAttribute("stroke", color);
      el.setAttribute("stroke-width", String(width));
      el.setAttribute("stroke-linecap", "round");
    } else {
      el = document.createElementNS(SVGNS, tool === "rect" ? "rect" : "ellipse");
      el.setAttribute("stroke", color);
      el.setAttribute("stroke-width", String(width));
      el.setAttribute("fill", "none");
      if (tool === "rect") el.setAttribute("rx", "6");
    }
    svg.appendChild(el);
    liveRef.current = el;
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!start.current || !liveRef.current) return;
    const p = toView(e);
    const el = liveRef.current;
    if (tool === "pen" || tool === "eraser") {
      pathStr.current += ` L${p.x} ${p.y}`;
      el.setAttribute("d", pathStr.current);
    } else if (tool === "line") {
      el.setAttribute("x2", String(p.x));
      el.setAttribute("y2", String(p.y));
    } else {
      const s = start.current;
      const x = Math.min(s.x, p.x), y = Math.min(s.y, p.y);
      const w = Math.abs(p.x - s.x), h = Math.abs(p.y - s.y);
      if (tool === "rect") {
        el.setAttribute("x", String(x)); el.setAttribute("y", String(y));
        el.setAttribute("width", String(w)); el.setAttribute("height", String(h));
      } else {
        el.setAttribute("cx", String(x + w / 2)); el.setAttribute("cy", String(y + h / 2));
        el.setAttribute("rx", String(w / 2)); el.setAttribute("ry", String(h / 2));
      }
    }
  }

  function up(e: React.PointerEvent<SVGSVGElement>) {
    const s = start.current;
    start.current = null;
    setDrawing(false);
    liveRef.current?.remove();
    liveRef.current = null;
    if (!s) return;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const p = toView(e);

    if (tool === "pen" || tool === "eraser") {
      const path = pathStr.current;
      pathStr.current = "";
      if (path.length < 8) return;
      onCommit(tool === "eraser"
        ? { type: "erase", path, width: Math.max(width, 14) }
        : { type: "path", path, color, width });
    } else if (tool === "line") {
      if (Math.hypot(p.x - s.x, p.y - s.y) < 5) return;
      onCommit({ type: "line", x1: s.x, y1: s.y, x2: p.x, y2: p.y, color, width });
    } else {
      const w = p.x - s.x, h = p.y - s.y;
      if (Math.abs(w) < 6 && Math.abs(h) < 6) return;
      onCommit({ type: tool, x: s.x, y: s.y, w, h, color, width });
    }
  }

  function commitText() {
    const v = textVal.trim();
    const at = textAt;
    setTextAt(null);
    setTextVal("");
    if (v && at) onCommit({ type: "text", x: at.vx, y: at.vy, text: v.slice(0, 120), color, size: Math.max(20, width * 5) });
  }

  return (
    <div className={`relative ${className ?? ""}`} style={style}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ display: "block", touchAction: "none", cursor: editable ? (tool === "text" ? "text" : "crosshair") : "default" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      >
        <defs>
          <pattern id={gridId} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.2" fill="#888" opacity="0.18" />
          </pattern>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gridId})`} />
        {strokes.map((s) => <StrokeEl key={s.id} data={s.data} />)}
      </svg>

      {strokes.length === 0 && !drawing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="mono text-[11px] tracking-widest opacity-30" style={{ color: "var(--v-muted)" }}>
            {placeholder ?? tr.elements.sketchEmpty}
          </span>
        </div>
      )}

      {/* Text entry — an input that floats where the canvas was tapped. */}
      {textAt && (
        <input
          autoFocus
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitText(); }
            else if (e.key === "Escape") { setTextAt(null); setTextVal(""); }
          }}
          placeholder="Text eingeben"
          maxLength={120}
          className="absolute bg-transparent outline-none text-[16px]"
          style={{ left: textAt.sx, top: textAt.sy - 14, color, borderBottom: `1px solid ${color}`, minWidth: 40 }}
        />
      )}
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────
const TOOL_GLYPH: Record<Tool, string> = {
  pen: "✎", eraser: "⌫", line: "╱", rect: "▭", ellipse: "◯", text: "T",
};

function Toolbar({
  tool, setTool, color, setColor, width, setWidth, trailing,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  trailing?: React.ReactNode;
}) {
  const toolBtn = (t: Tool) => (
    <button
      key={t}
      type="button"
      onClick={() => setTool(t)}
      title={t}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-[15px] shrink-0 transition-colors"
      style={{
        background: tool === t ? "var(--v-fg)" : "transparent",
        color: tool === t ? "var(--v-bg)" : "var(--v-fg)",
      }}
    >
      {TOOL_GLYPH[t]}
    </button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: "var(--v-rule)" }}>
        {(["pen", "eraser", "line", "rect", "ellipse", "text"] as Tool[]).map(toolBtn)}
      </div>

      {/* Colors */}
      <div className="flex items-center gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            title={c}
            aria-label={`color ${c}`}
            className="w-6 h-6 rounded-full shrink-0 transition-transform"
            style={{
              background: c,
              border: c.toLowerCase() === "#ffffff" ? "1px solid var(--v-rule)" : "1px solid transparent",
              outline: color.toLowerCase() === c.toLowerCase() ? "2px solid var(--v-fg)" : "none",
              outlineOffset: 1,
              transform: color.toLowerCase() === c.toLowerCase() ? "scale(1.1)" : "none",
            }}
          />
        ))}
      </div>

      {/* Sizes */}
      <div className="flex items-center gap-1">
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setWidth(s)}
            title={`size ${s}`}
            aria-label={`size ${s}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
            style={{ background: width === s ? "var(--v-rule)" : "transparent" }}
          >
            <span className="rounded-full" style={{ width: Math.min(s + 2, 14), height: Math.min(s + 2, 14), background: "var(--v-fg)" }} />
          </button>
        ))}
      </div>

      {trailing}
    </div>
  );
}

// ── Widget ───────────────────────────────────────────────────────────
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
  const tr = useT();
  const myColor = getMyColor();

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(myColor);
  const [width, setWidth] = useState(5);
  const [expanded, setExpanded] = useState(false);
  const [localUndo, setLocalUndo] = useState<Set<string>>(new Set());
  const [cleared, setCleared] = useState(false);

  const strokes: Stroke[] = state
    .filter((e) => e.kind === "stroke" && e.data && typeof e.data === "object")
    .sort((a, b) => a.createdAt - b.createdAt)
    .filter((e) => !localUndo.has(e.id) && !cleared)
    .map((e) => ({ id: e.id, data: e.data as Record<string, unknown> }));

  const allStrokeIds = state.filter((e) => e.kind === "stroke");

  function commit(data: Record<string, unknown>) {
    setCleared(false);
    void ctx.act(index, "stroke", data);
  }

  function undo() {
    const myId = getSelfId();
    const mine = strokes.filter((e) => {
      const entry = state.find((s) => s.id === e.id);
      return entry?.actor.id === myId;
    });
    if (mine.length === 0) return;
    setLocalUndo((s) => new Set([...s, mine[mine.length - 1].id]));
  }

  function clearAll() {
    if (!ctx.isOwner) return;
    setLocalUndo(new Set(allStrokeIds.map((e) => e.id)));
    setCleared(true);
  }

  // Lock the page scroll while the full-screen editor is open.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [expanded]);

  const footer = (
    <div className="flex items-center gap-3">
      {strokes.length > 0 && (
        <button type="button" onClick={undo} title="undo last stroke"
          className="mono text-[12px] opacity-60 hover:opacity-100" style={{ color: "var(--v-fg)" }}>↩</button>
      )}
      {ctx.isOwner && strokes.length > 0 && (
        <button type="button" onClick={clearAll} title="clear canvas"
          className="mono text-[12px] opacity-40 hover:opacity-100" style={{ color: "var(--v-fg)" }}>×</button>
      )}
    </div>
  );

  const portalTarget = typeof document !== "undefined"
    ? (document.querySelector(".vibe-root") ?? document.body)
    : null;

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {/* In-widget canvas — drawable in place, or expand for room. */}
        <SketchCanvas
          strokes={strokes}
          tool={tool}
          color={color}
          width={width}
          editable
          onCommit={commit}
          placeholder={m.placeholder}
          style={{ background: "var(--v-bg)", borderRadius: "inherit", overflow: "hidden" }}
        />

        {/* Compact controls + expand. */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0 overflow-x-auto">
            <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor} width={width} setWidth={setWidth} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {footer}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="expand"
              className="mono text-[12px] px-2 h-7 flex items-center rounded-lg"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
            >⤢</button>
          </div>
        </div>
      </WidgetCard>

      {/* Full-screen editor. */}
      {expanded && portalTarget && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--v-page, var(--v-bg))" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--v-rule)" }}>
            <span className="mono text-[10px] tracking-widest uppercase" style={{ color: "var(--v-muted)" }}>
              {m.microTitle || "sketch"}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full"
              style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
            >done</button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6">
            <div
              className="w-full"
              style={{ maxWidth: "min(100%, calc((100vh - 200px) * 1.6))", aspectRatio: `${VIEW_W} / ${VIEW_H}`, border: "1px solid var(--v-rule)", borderRadius: "var(--v-radius)", overflow: "hidden" }}
            >
              <SketchCanvas
                strokes={strokes}
                tool={tool}
                color={color}
                width={width}
                editable
                onCommit={commit}
                placeholder={m.placeholder}
                style={{ background: "var(--v-bg)", height: "100%" }}
              />
            </div>
          </div>

          <div
            className="px-4 py-3 flex items-center justify-between gap-3 overflow-x-auto"
            style={{ borderTop: "1px solid var(--v-rule)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor} width={width} setWidth={setWidth} />
            {footer}
          </div>
        </div>,
        portalTarget,
      )}
    </WidgetShell>
  );
}
