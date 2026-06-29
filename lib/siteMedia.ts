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
  /** Real asset URL/path. Leave undefined to render the placeholder. */
  src?: string;
}

export type MediaKey =
  | "heroFootage"
  | "behindScenes"
  | "shootingSetup"
  | "moodboard"
  | "projectPage"
  | "alignment"
  | "handoff";

export const SITE_MEDIA: Record<MediaKey, SiteMedia> = {
  heroFootage: { label: "Hero Footage", alt: "Fotograf:in bei einem Shooting — Hero-Footage" },
  behindScenes: { label: "Behind-the-scenes", alt: "Behind-the-scenes-Eindruck am Set" },
  shootingSetup: { label: "Shooting Setup", alt: "Aufgebautes Shooting-Setup mit Licht und Kamera" },
  moodboard: { label: "Moodboard Preview", alt: "Moodboard mit Referenzbildern und Farbwelt" },
  projectPage: { label: "Projektseiten Preview", alt: "Vorschau einer strukturierten MAGYC-Projektseite" },
  alignment: { label: "Kunde/Fotograf-Abstimmung", alt: "Kunde und Fotograf:in stimmen ein Projekt über einen Link ab" },
  handoff: { label: "Finale Übergabe/Freigabe", alt: "Finale Übergabe und Freigabe der Bilder" },
};
