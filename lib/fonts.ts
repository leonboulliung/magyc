/**
 * Curated Google Fonts catalog.
 *
 * The AI picks one of these per space (by mood); the owner can swap to
 * any other from this list in the style editor. We use a curated set
 * rather than the full Google Fonts directory so:
 *   - the list is usable (24 strong choices, not 1500),
 *   - loading needs no API key (the CSS2 endpoint is keyless),
 *   - every option is known-good across the widget set.
 *
 * Each font loads via:
 *   https://fonts.googleapis.com/css2?family=<Family>:wght@...&display=swap
 */

export interface FontSpec {
  /** Google Fonts family name, exactly as the API expects it. */
  name: string;
  /** Category, for the editor's grouping + the AI's mood matching. */
  category: "sans" | "serif" | "mono" | "display" | "hand";
  /** Weight axis to request. */
  weights: string;
}

export const FONT_CATALOG: FontSpec[] = [
  // Sans — neutral, modern
  { name: "Inter",            category: "sans",    weights: "300;400;500;700;900" },
  { name: "Work Sans",        category: "sans",    weights: "300;400;500;700" },
  { name: "Space Grotesk",    category: "sans",    weights: "300;400;500;700" },
  { name: "DM Sans",          category: "sans",    weights: "400;500;700" },
  { name: "Manrope",          category: "sans",    weights: "300;400;500;700;800" },
  { name: "Outfit",           category: "sans",    weights: "300;400;500;700" },
  { name: "Archivo",          category: "sans",    weights: "400;500;700;900" },

  // Serif — editorial, warm
  { name: "Source Serif 4",   category: "serif",   weights: "300;400;600;700" },
  { name: "Lora",             category: "serif",   weights: "400;500;700" },
  { name: "Fraunces",         category: "serif",   weights: "300;400;500;700;900" },
  { name: "Playfair Display", category: "serif",   weights: "400;500;700;900" },
  { name: "Spectral",         category: "serif",   weights: "300;400;600;800" },
  { name: "Cormorant",        category: "serif",   weights: "300;400;500;700" },

  // Mono — technical, precise
  { name: "JetBrains Mono",   category: "mono",    weights: "400;500;700" },
  { name: "Space Mono",       category: "mono",    weights: "400;700" },
  { name: "IBM Plex Mono",    category: "mono",    weights: "300;400;500;600" },

  // Display — bold, characterful
  { name: "Bricolage Grotesque", category: "display", weights: "400;500;700;800" },
  { name: "Unbounded",        category: "display", weights: "300;400;600;800" },
  { name: "Syne",             category: "display", weights: "400;600;700;800" },
  { name: "Clash Display",    category: "display", weights: "400;500;600;700" },

  // Hand / soft
  { name: "Caveat",           category: "hand",    weights: "400;500;700" },
  { name: "Gloria Hallelujah", category: "hand",   weights: "400" },
  { name: "Shantell Sans",    category: "hand",    weights: "300;400;500;700" },
  { name: "Quicksand",        category: "hand",    weights: "400;500;700" },
];

const BY_NAME = new Map(FONT_CATALOG.map((f) => [f.name.toLowerCase(), f]));

export function findFont(name: string | undefined | null): FontSpec | null {
  if (!name) return null;
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}

/** Build the Google Fonts CSS2 href for a family (or several). */
export function googleFontsHref(specs: FontSpec[]): string {
  if (specs.length === 0) return "";
  const families = specs
    .map((s) => `family=${encodeURIComponent(s.name).replace(/%20/g, "+")}:wght@${s.weights}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** A CSS font-family stack for a chosen family, with a sane fallback
 *  by category. */
export function fontStack(spec: FontSpec | null): string {
  if (!spec) return "Inter, ui-sans-serif, system-ui, sans-serif";
  const fallback =
    spec.category === "serif" ? "Georgia, serif" :
    spec.category === "mono" ? "ui-monospace, SFMono-Regular, monospace" :
    "ui-sans-serif, system-ui, sans-serif";
  return `"${spec.name}", ${fallback}`;
}

/** Names only — handy for the AI prompt + the editor. */
export const FONT_NAMES: string[] = FONT_CATALOG.map((f) => f.name);
