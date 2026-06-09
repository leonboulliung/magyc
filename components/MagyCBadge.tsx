"use client";

/**
 * Bottom-right brand badge. Quiet, small, always present so the
 * surface stays attributed.
 */
export function MagyCBadge() {
  return (
    <a
      href="/"
      className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100 transition-opacity"
      style={{ color: "var(--v-fg)" }}
    >
      magyc.site
    </a>
  );
}
