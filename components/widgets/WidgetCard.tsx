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
}: {
  microTitle?: React.ReactNode;
  description?: string;
  attribution?: { name: string; url: string; license: string };
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <motion.div
      className={`rounded-md ${bare ? "" : "p-4"}`}
      style={{
        // Body widgets carry the space's secondary colour (color2):
        // a faint wash for the surface + a softened accent frame.
        border: "1px solid var(--v-widget-border, var(--v-rule))",
        background: "var(--v-widget, var(--v-bg))",
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {microTitle && (
        <div
          className="mono text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--v-muted)" }}
        >
          {microTitle}
        </div>
      )}
      {children}
      {description && (
        <p className="mono text-[10px] mt-3" style={{ color: "var(--v-muted)" }}>
          {description}
        </p>
      )}
      {attribution && (
        <p className="mono text-[9px] mt-2 opacity-60" style={{ color: "var(--v-muted)" }}>
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
