/**
 * Marketing-site config — navigation, footer, and the "areas" (creative
 * domains) that map onto the product's project modes. Pure data so the
 * site chrome stays declarative and easy to extend page by page.
 *
 * This is the stable PUBLIC brand surface. It deliberately does NOT use
 * the per-space CSS variables (`--v-*`) — those theme individual Spaces.
 * The marketing site keeps one fixed brand look (see `brand` below).
 */

/** Fixed brand palette for the marketing site (not per-space themed). */
export const brand = {
  bg: "#000000",
  surface: "rgba(255,255,255,0.055)",
  ink: "#ffffff",
  muted: "rgba(255,255,255,0.68)",
  rule: "rgba(255,255,255,0.16)",
  accent: "rgba(255,255,255,0.92)",
  accentSoft: "rgba(255,255,255,0.08)",
} as const;

export interface NavLink {
  href: string;
  label: string;
}

/** Top navigation (primary). The "Start" CTA is rendered separately.
 *  Labels point at real routes (the previous set linked to mismatched
 *  pages). Focused on the Commercial/Product beachhead — see
 *  docs/STRATEGY.md. */
export const NAV_LINKS: NavLink[] = [
  { href: "/product", label: "Für Fotografen" },
  { href: "/showcase", label: "Beispiele" },
  { href: "/how-it-works", label: "So funktioniert's" },
  { href: "/roadmap", label: "Roadmap" },
];

export interface FooterGroup {
  title: string;
  links: NavLink[];
}

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: "Produkt",
    links: [
      { href: "/product", label: "Für Fotografen" },
      { href: "/how-it-works", label: "So funktioniert's" },
      { href: "/showcase", label: "Beispiele" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Für",
    links: [
      { href: "/product", label: "Produktfotografie" },
      { href: "/corporate", label: "Corporate-Fotografie" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { href: "/story", label: "Geschichte" },
      { href: "/docs", label: "Doku" },
      { href: "/contact", label: "Kontakt" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/legal/imprint", label: "Impressum" },
      { href: "/legal/privacy", label: "Datenschutz" },
      { href: "/legal/terms", label: "AGB" },
    ],
  },
];

/**
 * Creative "areas" — the public segment pages. They mirror the product's
 * project modes (lib/projectModes.ts) so the marketing and the tool tell
 * the same story. `slug` is the /for/<slug> route.
 */
export interface Area {
  slug: string;
  label: string;
  /** One-line positioning placeholder — replace with real copy later. */
  tagline: string;
  /** Maps to a ProjectModeId where one exists. */
  mode?: string;
}

export const AREAS: Area[] = [
  { slug: "photography", label: "Photography", tagline: "Shoots, from first idea to call sheet.", mode: "photo_shoot" },
  { slug: "events", label: "Events", tagline: "Plan, staff, and run the day together.", mode: "event" },
  { slug: "trips", label: "Trips", tagline: "Routes, stops, and shared logistics.", mode: "trip" },
  { slug: "campaigns", label: "Campaigns", tagline: "Briefs, deliverables, and approvals.", mode: "campaign" },
  { slug: "workshops", label: "Workshops", tagline: "Agenda, materials, and participants.", mode: "workshop" },
];

export function areaBySlug(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}
