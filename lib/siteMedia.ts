/**
 * Central registry for the marketing site's image/video areas. Each entry is a
 * clearly-named slot; to go live, just set `src` to a real asset (e.g. an
 * Unsplash URL or /public path) — the layout stays identical because
 * `MediaFrame` swaps the dashed placeholder for the real image in the same
 * framed box. Categories match the briefed footage list.
 */
export interface SiteMedia {
  /** Short category label shown on the placeholder. */
  label: string;
  /** Alt text used once a real image is set (accessibility). */
  alt: string;
  /** Whether the slot renders as an image or inline looping video. */
  kind?: "image" | "video";
  /** Real asset URL/path. Leave undefined to render the placeholder. */
  src?: string;
  /** Optional poster image for video slots. */
  posterSrc?: string;
}

export type MediaKey =
  | "heroFootage"
  | "behindScenes"
  | "shootingSetup"
  | "moodboard"
  | "projectPage"
  | "projectPageStill"
  | "alignment"
  | "handoff"
  | "productTile"
  | "eventTile"
  | "weddingTile"
  | "corporateTile"
  | "fashionTile";

export const SITE_MEDIA: Record<MediaKey, SiteMedia> = {
  heroFootage: {
    label: "Hero Footage",
    alt: "Fotograf:in bei einem Shooting — Hero-Footage",
    src: "/media/marketing/hero-footage.jpg",
  },
  behindScenes: {
    label: "Behind-the-scenes",
    alt: "Behind-the-scenes-Eindruck am Set",
    src: "/media/marketing/behind-the-scenes.png",
  },
  shootingSetup: {
    label: "Shooting Setup",
    alt: "Aufgebautes Shooting-Setup mit Licht und Kamera",
    src: "/media/marketing/produkt-fotografie-kachel.jpg",
  },
  moodboard: {
    label: "Moodboard Preview",
    alt: "Moodboard mit Referenzbildern und Farbwelt",
    kind: "video",
    src: "/media/marketing/moodboard-preview.mp4",
  },
  projectPage: {
    label: "Projektseiten Preview",
    alt: "Vorschau einer strukturierten MAGYC-Projektseite",
    kind: "video",
    src: "/media/marketing/projektseiten-preview.mp4",
    posterSrc: "/media/marketing/projektseite-preview.png",
  },
  projectPageStill: {
    label: "Projektseiten Preview",
    alt: "Vorschau einer strukturierten MAGYC-Projektseite",
    src: "/media/marketing/projektseite-preview.png",
  },
  alignment: {
    label: "Kunde/Fotograf-Abstimmung",
    alt: "Kunde und Fotograf:in stimmen ein Projekt über einen Link ab",
    src: "/media/marketing/fotograf-abstimmung.png",
  },
  handoff: {
    label: "Finale Übergabe/Freigabe",
    alt: "Finale Übergabe und Freigabe der Bilder",
    src: "/media/marketing/finale-uebergabe.png",
  },
  productTile: {
    label: "Produkt-Fotografie",
    alt: "Produktfotografie als Anwendungsfall",
    src: "/media/marketing/produkt-fotografie-kachel.jpg",
  },
  eventTile: {
    label: "Event-Fotografie",
    alt: "Eventfotografie als Anwendungsfall",
    src: "/media/marketing/event-fotografie-kachel.jpg",
  },
  weddingTile: {
    label: "Hochzeits-Fotografie",
    alt: "Hochzeitsfotografie als Anwendungsfall",
    src: "/media/marketing/hochzeit-fotografie.jpg",
  },
  corporateTile: {
    label: "Corporate-Fotografie",
    alt: "Corporatefotografie als Anwendungsfall",
    src: "/media/marketing/corporate-fotografie-kachel.jpg",
  },
  fashionTile: {
    label: "Fashion-Fotografie",
    alt: "Fashionfotografie als Anwendungsfall",
    src: "/media/marketing/fashion-fotografie-kachel.jpg",
  },
};
