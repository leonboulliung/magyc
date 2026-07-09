/**
 * Marketing-site config — navigation, footer, and the "areas" (creative
 * domains) that map onto the product's project modes. Pure data so the
 * site chrome stays declarative and easy to extend page by page.
 *
 * This is the stable PUBLIC brand surface. It deliberately does NOT use
 * the per-space CSS variables (`--v-*`) — those theme individual Spaces.
 * The marketing site keeps one fixed light brand look (see `brand` below).
 */

import type { Dictionary } from "@/lib/i18n/dictionaries/de";

/** Fixed brand palette for the marketing site (not per-space themed). */
export const brand = {
  bg: "#f4f4f1",
  surface: "#ffffff",
  ink: "#17171a",
  muted: "rgba(23,23,26,0.58)",
  rule: "rgba(0,0,0,0.12)",
  accent: "rgba(23,23,26,0.82)",
  accentSoft: "rgba(0,0,0,0.035)",
} as const;

export interface NavLink {
  href: string;
  label: string;
}

/** A top-nav entry is either a direct link or a labelled dropdown group. */
export interface NavGroup {
  label: string;
  items: NavLink[];
}
export type NavEntry = NavLink | NavGroup;
export function isNavGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).items !== undefined;
}

/**
 * Use cases — the photography segments. Single source of truth, reused by
 * the "Anwendungsfälle" nav dropdown AND the footer. Each maps to a
 * segment landing page (lib/segments.ts). Order = adjacency to our
 * strengths (see docs/STRATEGY.md §11).
 */
export function useCases(t: Dictionary): NavLink[] {
  return [
    { href: "/product", label: t.nav.product },
    { href: "/event", label: t.nav.event },
    { href: "/wedding", label: t.nav.wedding },
    { href: "/corporate", label: t.nav.corporate },
    { href: "/fashion", label: t.nav.fashion },
  ];
}

/** Top navigation (primary). Sign-in + the CTA are rendered separately.
 *  Roadmap deliberately lives in the footer, not here. */
export function mainNav(t: Dictionary): NavEntry[] {
  return [
    { label: t.nav.useCasesLabel, items: useCases(t) },
    { href: "/how-it-works", label: t.nav.howItWorks },
  ];
}

export interface FooterGroup {
  title: string;
  links: NavLink[];
}

export function footerGroups(t: Dictionary): FooterGroup[] {
  return [
    { title: t.nav.useCasesLabel, links: useCases(t) },
    {
      title: t.nav.product,
      links: [
        { href: "/how-it-works", label: t.nav.howItWorks },
        { href: "/roadmap", label: t.nav.roadmap },
        { href: "/changelog", label: t.nav.changelog },
      ],
    },
    {
      title: t.nav.company,
      links: [
        { href: "/story", label: t.nav.story },
        { href: "/docs", label: t.nav.docs },
        { href: "/contact", label: t.nav.contact },
      ],
    },
    {
      title: t.nav.legal,
      links: [
        { href: "/legal/imprint", label: t.nav.imprint },
        { href: "/legal/privacy", label: t.nav.privacy },
        { href: "/legal/terms", label: t.nav.terms },
      ],
    },
  ];
}

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
