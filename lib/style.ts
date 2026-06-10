import type { SpaceStyle } from "./types";

/**
 * Style helpers — turn a SpaceStyle (font + 3 colors) into the full set
 * of CSS variables the vibe system already consumes, and validate /
 * default styles coming from the AI or the editor.
 */

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v.trim());
}

/** Normalise a 3- or 6-digit hex to 6-digit lowercase. */
export function normHex(v: string): string {
  let h = v.trim().toLowerCase();
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h;
}

/** Parse #rrggbb → [r,g,b]. */
function toRgb(hex: string): [number, number, number] {
  const h = normHex(hex);
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** Mix a color toward another by t (0..1). */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Relative luminance (0..1) for contrast decisions. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A readable foreground (black/white) for a given background. */
export function readableOn(bg: string): string {
  return luminance(bg) > 0.5 ? "#0d0d0d" : "#ffffff";
}

/**
 * Build the CSS-variable overrides from a style. These are applied
 * inline on the space root, where they win over the vibe class vars.
 *
 *   --v-fg     = color1 (ink: text, borders, pins)
 *   --v-accent = color2 (widget accents, map fills)
 *   --v-page   = background (page canvas)
 *   --v-bg     = white   (cards + grid stay white per spec)
 *   --v-rule   = color1 @ ~14%
 *   --v-muted  = color1 @ ~48%
 */
export function styleVars(style: SpaceStyle, fontStackValue: string): React.CSSProperties {
  const ink = normHex(style.color1);
  const accent = normHex(style.color2);
  const page = normHex(style.background);
  return {
    // Custom props — cast through a record so TS accepts the css vars.
    ["--v-fg" as string]: ink,
    ["--v-accent" as string]: accent,
    ["--v-page" as string]: page,
    ["--v-bg" as string]: "#ffffff",
    ["--v-rule" as string]: mix(ink, "#ffffff", 0.86),
    ["--v-muted" as string]: mix(ink, "#ffffff", 0.5),
    ["--v-font" as string]: fontStackValue,
    ["--v-heading" as string]: fontStackValue,
  } as React.CSSProperties;
}

/** Validate an arbitrary object into a SpaceStyle, or null. */
export function sanitizeStyle(raw: unknown): SpaceStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const font = typeof r.font === "string" ? r.font.trim().slice(0, 60) : "";
  if (!font) return null;
  if (!isHex(r.color1) || !isHex(r.color2) || !isHex(r.background)) return null;
  return {
    font,
    color1: normHex(r.color1 as string),
    color2: normHex(r.color2 as string),
    background: normHex(r.background as string),
  };
}

/** A neutral default when no style was assigned. */
export const DEFAULT_STYLE: SpaceStyle = {
  font: "Inter",
  color1: "#0d0d0d",
  color2: "#6b6b6b",
  background: "#ffffff",
};
