import type { SpaceStyle } from "./types";

/**
 * Style helpers — turn a SpaceStyle (font + accent) into the full set
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

// ── HSL conversion + per-role lightness clamping ──────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Re-light a colour into a target lightness/saturation band, keeping
 *  its hue. Guarantees readability regardless of what the AI returns. */
function reLight(hex: string, lMin: number, lMax: number, sMax: number): string {
  const [r, g, b] = toRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex(h, clamp(s, 0, sMax), clamp(l, lMin, lMax));
}

/**
 * Force a style into the always-readable design band:
 *   - canvas and ink are fixed by the verified light workspace system
 *   - color2 (accent) carries widget/map highlights only
 * This is applied to every style so old AI/editor values cannot make the
 * surface unreadable.
 */
export function normalizeStyle(style: SpaceStyle): SpaceStyle {
  const font = ["Inter", "Barlow", "Space Grotesk"].includes(style.font)
    ? "Manrope"
    : style.font;
  return {
    font,
    background: "#f4f4f1",
    color1: "#17171a",
    color2: reLight(style.color2, 0.4, 0.6, 0.85),
  };
}

/**
 * Build the CSS-variable overrides from a style. These are applied
 * inline on the space root, where they win over the vibe class vars.
 *
 *   --v-page   = application canvas for the selected mode
 *   --v-bg     = surface base for controls
 *   --v-fg     = readable interface ink
 *   --v-accent = color2 (widget accents, map fills)
 *   --v-rule   = translucent glass border
 *   --v-muted  = subdued white copy
 */
export type ProjectThemeMode = "dark" | "light";

export function styleVars(
  style: SpaceStyle,
  fontStackValue: string,
  mode: ProjectThemeMode = "light",
): React.CSSProperties {
  const accent = normHex(style.color2);
  const headingStackValue = style.font === "Manrope"
    ? '"Bricolage Grotesque", "Manrope", ui-sans-serif, system-ui, sans-serif'
    : fontStackValue;
  const base = mode === "light"
    ? {
        ["--v-fg" as string]: "#17171a",
        ["--v-page" as string]: "#f4f4f1",
        ["--v-bg" as string]: "#ffffff",
        ["--v-rule" as string]: "rgba(0,0,0,0.12)",
        ["--v-muted" as string]: "rgba(0,0,0,0.55)",
        ["--v-card" as string]: "#ffffff",
        ["--v-control" as string]: "rgba(0,0,0,0.045)",
        ["--v-widget" as string]: `color-mix(in srgb, ${accent} 9%, #ffffff)`,
        ["--v-widget-border" as string]: `color-mix(in srgb, ${accent} 38%, rgba(0,0,0,0.14))`,
        ["--v-grid" as string]: "#ebeae6",
        ["--v-grid-dot" as string]: "rgba(0,0,0,0.17)",
        ["--v-grid-shadow" as string]: "inset 0 1px 0 rgba(255,255,255,0.82), 0 18px 60px rgba(20,20,24,0.09)",
        ["--v-widget-shadow" as string]: "inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 30px rgba(20,20,24,0.07)",
      }
    : {
        ["--v-fg" as string]: "#ffffff",
        ["--v-page" as string]: "#000000",
        ["--v-bg" as string]: "#050505",
        ["--v-rule" as string]: "rgba(255,255,255,0.22)",
        ["--v-muted" as string]: "rgba(255,255,255,0.68)",
        ["--v-card" as string]: "#101010",
        ["--v-control" as string]: "rgba(255,255,255,0.055)",
        ["--v-widget" as string]: `color-mix(in srgb, ${accent} 20%, #171717)`,
        ["--v-widget-border" as string]: `color-mix(in srgb, ${accent} 44%, rgba(255,255,255,0.28))`,
        ["--v-grid" as string]: "#080808",
        ["--v-grid-dot" as string]: "rgba(255,255,255,0.22)",
        ["--v-grid-shadow" as string]: "inset 0 1px 1px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.24)",
        ["--v-widget-shadow" as string]: "inset 0 1px 1px rgba(255,255,255,0.12), 0 14px 40px rgba(0,0,0,0.18)",
      };
  return {
    // Custom props — cast through a record so TS accepts the css vars.
    ["--v-accent" as string]: accent,
    ...base,
    ["--v-radius" as string]: "28px",
    ["--v-font" as string]: fontStackValue,
    ["--v-heading" as string]: headingStackValue,
  } as React.CSSProperties;
}

/** Validate an arbitrary object into a SpaceStyle, or null. Always
 *  normalised into the readable design band. */
export function sanitizeStyle(raw: unknown): SpaceStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const font = typeof r.font === "string" ? r.font.trim().slice(0, 60) : "";
  if (!font) return null;
  if (!isHex(r.color1) || !isHex(r.color2) || !isHex(r.background)) return null;
  return normalizeStyle({
    font,
    color1: normHex(r.color1 as string),
    color2: normHex(r.color2 as string),
    background: normHex(r.background as string),
  });
}

/** A neutral default when no style was assigned. */
export const DEFAULT_STYLE: SpaceStyle = {
  font: "Manrope",
  color1: "#0d0d0d",
  color2: "#6b6b6b",
  background: "#ffffff",
};
