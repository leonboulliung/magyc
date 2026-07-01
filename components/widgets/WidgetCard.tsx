"use client";

import { motion } from "motion/react";

/**
 * Shared visual frame for every non-header widget. Each card enters
 * with a subtle lift (opacity + y) so the grid feels assembled rather
 * than just appearing. The animation is very short so it doesn't
 * compete with the grid stagger from GridZone.
 */
export function WidgetCard({
  microTitle,
  description,
  attribution,
  children,
  bare = false,
  allowOverflow = false,
}: {
  microTitle?: React.ReactNode;
  description?: string;
  attribution?: { name: string; url: string; license: string };
  children: React.ReactNode;
  bare?: boolean;
  allowOverflow?: boolean;
}) {
  const paddedClass = microTitle ? "p-3.5" : "px-3.5 pb-3.5 pt-8";
  return (
    <motion.div
      className={`min-w-0 rounded-[var(--v-radius)] [overflow-wrap:anywhere] ${bare ? (allowOverflow ? "overflow-visible" : "overflow-hidden") : `${paddedClass} overflow-hidden`}`}
      style={{
        border: "1px solid var(--v-widget-border, var(--v-rule))",
        background: "var(--v-widget, var(--v-bg))",
        boxShadow: "var(--v-widget-shadow)",
        backdropFilter: "blur(16px)",
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* In `bare` mode the children are full-bleed (maps, canvases,
          images), so the card has no padding — but the title and footer
          must still be inset, otherwise they sit flush in the rounded
          corner and read as "outside" the card. */}
      {microTitle && (
        <div
          className={`mono mb-2.5 text-[10px] uppercase tracking-widest ${bare ? "px-3.5 pt-3.5" : ""}`}
          style={{ color: "var(--v-muted)" }}
        >
          {microTitle}
        </div>
      )}
      {children}
      {description && (
        <p className={`mono mt-2.5 text-[10px] ${bare ? "px-3.5" : ""}`} style={{ color: "var(--v-muted)" }}>
          {description}
        </p>
      )}
      {attribution && (
        <p className={`mono mt-2 text-[9px] opacity-60 ${bare ? "px-3.5 pb-3" : ""}`} style={{ color: "var(--v-muted)" }}>
          ↗ {attribution.name} ·{" "}
          <a href={attribution.url} target="_blank" rel="noreferrer noopener" className="underline">
            {attribution.license}
          </a>
        </p>
      )}
    </motion.div>
  );
}

/**
 * A small avatar dot — actor attribution. Appears with a quick pop.
 */
export function ActorDot({
  color,
  displayName,
  size = 18,
}: {
  color?: string | null;
  displayName?: string;
  size?: number;
}) {
  const initial = (displayName || "?").slice(0, 1).toUpperCase();
  return (
    <motion.span
      className="inline-flex items-center justify-center rounded-full mono"
      style={{
        width: size,
        height: size,
        background: color || "var(--v-rule)",
        color: color ? "#fff" : "var(--v-fg)",
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
        fontWeight: 600,
        textShadow: color ? "0 1px 1px rgba(0,0,0,0.15)" : "none",
      }}
      title={displayName}
      aria-label={displayName}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
    >
      {initial}
    </motion.span>
  );
}
