/**
 * Segment landing content — data-driven marketing pages per photography
 * segment. One reusable renderer (components/site/SegmentLanding.tsx)
 * consumes a Segment. The product/engine is horizontal; the MESSAGE is
 * differentiated by each segment's dominant bottleneck (see
 * docs/STRATEGY.md §11). Product is the primary beachhead; others are
 * staggered acquisition doors.
 *
 * To add a segment: add an entry here + a thin wrapper page under
 * app/(site)/<slug>/page.tsx. Imagery is optional — without it the work
 * band renders labelled placeholders (no stock photos).
 */

export interface SampleImage {
  src: string;
  alt: string;
}

/** A building block; `icon` is a key into ICONS in SegmentLanding. */
export interface SegmentBlock {
  icon: string;
  name: string;
  role: string;
}

export interface LifecycleStep {
  n: string;
  title: string;
  lead: string;
  note: string;
}

export interface Segment {
  slug: string;
  /** Short label for chips / footer / inter-segment links. */
  label: string;
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    headline: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    /** Real hero image; if omitted, a labelled placeholder is shown. */
    image?: { src: string; alt: string; caption?: string };
    placeholderLabel?: string;
  };
  problem: { eyebrow: string; heading: string; cards: { big: string; small: string }[] };
  work: {
    eyebrow: string;
    heading: string;
    lead: string;
    /** Real images; if omitted, `placeholderLabels` render dashed frames. */
    images?: SampleImage[];
    placeholderLabels?: string[];
    footnote: string;
  };
  lifecycle: { eyebrow: string; heading: string; steps: LifecycleStep[] };
  blocks: { eyebrow: string; heading: string; lead: string; items: SegmentBlock[]; footnote: string };
  present: {
    eyebrow: string;
    heading: string;
    sub: string;
    fromLabel: string;
    toLabel: string;
    mediaLabel: string;
    mediaCaption: string;
  };
  positioning: { eyebrow: string; heading: string; sub: string };
  cta: { headline: string; button: string };
}

// Shared positioning — identical promise across segments (the AI does the
// busywork, the photographer keeps the craft). Repeated by reference.
const POSITIONING = {
  eyebrow: "Wo die KI hilft",
  heading: "Die KI macht den Bürokram. Du behältst das Handwerk.",
  sub:
    "MAGYC fasst deine Bilder und deinen Stil nicht an. Sie übernimmt die Struktur, die Admin und die Übergabe — die unsichtbaren Stunden zwischen den Shootings. Das Shooting gehört dir, und das letzte Wort auch.",
};

const PRESENT_SHARED = {
  eyebrow: "Wenn das Shooting steht",
  heading: "Dasselbe Projekt, neu geboren als Präsentation.",
  fromLabel: "PLANEN",
  toLabel: "PRÄSENTIEREN",
  mediaLabel: "Auto-generierte Präsentationsseite",
  mediaCaption: "Annotiertes Beispiel · folgt",
};

// ── Produkt / Commercial — the primary beachhead ──────────────────────
const PRODUCT: Segment = {
  slug: "product",
  label: "Produktfotografie",
  meta: {
    title: "MAGYC für Produktfotografen",
    description:
      "Von der ersten Kundenmail bis zur fertigen Übergabe — ein Ort, der sich um das Shooting herum aufbaut. Einmal eingeben; nie wieder dasselbe Briefing abtippen.",
  },
  hero: {
    eyebrow: "Für Produkt- & Commercial-Fotografen",
    headline: "Das Foto ist der einfache Teil.",
    sub:
      "Das Briefing, die Rechte, die Shotlist, die Freigaben, die Übergabe — dort entsteht oder verschwindet die Marge. MAGYC macht aus der ersten Kundenmail ein gemeinsames Projekt und aus dem fertigen Shooting eine Präsentation. Einmal eingeben; nie wieder denselben Auftrag abtippen.",
    ctaPrimary: "Projekt starten",
    ctaSecondary: "Beispielprojekt ansehen →",
    image: {
      src: "/media/hero-bts.jpg",
      alt: "Produktshooting im dunklen Studio: getetherte Kamera, Laptop, Produkt auf dem Sweep",
      caption: "Set · Produktshooting",
    },
  },
  problem: {
    eyebrow: "Der eigentliche Job",
    heading: "Ein Commercial-Shooting ist ein Koordinationsproblem mit Kamera.",
    cards: [
      { big: "2–6 Tools", small: "pro Projekt — CRM, Galerie, Mail, Tabelle, Vertrag — und in jedes tippst du dieselben Daten neu." },
      { big: "Die unsichtbaren Stunden", small: "Briefing, Nutzungsrechte, Freigaben, Delivery-Konfiguration: Hier versickert die Marge leise." },
      { big: "Jedes Mal neu gebaut", small: "Die Übergabe und die Case Study werden jedes Mal von Hand zusammengestellt." },
    ],
  },
  work: {
    eyebrow: "Gemacht für Arbeit wie diese",
    heading: "Vom Stillleben über Beauty bis Tech.",
    lead: "MAGYC trägt das Projekt — du machst die Bilder.",
    images: [
      { src: "/media/work-watch.jpg", alt: "Luxusuhr auf schwarzem Samt" },
      { src: "/media/work-skincare.jpg", alt: "Skincare-Stillleben" },
      { src: "/media/work-sneaker.jpg", alt: "Sneaker-Hero auf dunklem Grund" },
      { src: "/media/work-tech.jpg", alt: "Mattschwarzes Tech-Gerät" },
      { src: "/media/work-coffee.jpg", alt: "Kaffee-Pour, moody" },
      { src: "/media/work-vase.jpg", alt: "Designer-Keramikvase im dunklen Interieur" },
    ],
    footnote: "Beispielhafte Produktfotografie · keine Stockbilder",
  },
  lifecycle: {
    eyebrow: "Ein Projekt, drei Phasen",
    heading: "Dasselbe Projekt — vom Briefing bis zur Übergabe getragen.",
    steps: [
      { n: "01", title: "Briefing", lead: "Leite die Kundenmail weiter — oder tippe den Auftrag in einem Satz. MAGYC liest mit und baut das Projekt: Deliverables, Nutzung, Shooting-Termin, Location, Crew.", note: "Das Briefing lebt nicht mehr im Postfach." },
      { n: "02", title: "Produktion", lead: "Ein gemeinsamer Raum fürs Shooting. Kunde, Assistenz, Styling und Retusche arbeiten in derselben Struktur — Shotlist, Freigaben und Feedback an einem Ort.", note: "Alle sehen dieselbe Wahrheit." },
      { n: "03", title: "Präsentation", lead: "Ist das Shooting fertig, macht ein Klick aus demselben Projekt eine gebrandete Übergabe-Seite. Die Daten sind schon da — nichts neu zu bauen.", note: "Von der Planungs- zur Präsentationsfläche, automatisch." },
    ],
  },
  blocks: {
    eyebrow: "Die Bausteine",
    heading: "Kein Template. Ein Baukasten aus kleinen, scharfen Teilen.",
    lead: "MAGYC setzt jedes Projekt aus fokussierten Bausteinen zusammen und wählt die, die dein Shooting wirklich braucht — statt es in eine starre Form zu pressen.",
    items: [
      { icon: "deliverables", name: "Deliverables", role: "Jedes Asset, Format und jede Menge, die der Kunde erwartet." },
      { icon: "approvals", name: "Freigaben", role: "Sign-off-Punkte, die der Kunde abhakt — Kunde oder intern." },
      { icon: "crew", name: "Crew & Rollen", role: "Assistenz, Styling, Retusche, Agentur — geclaimt, nicht hinterhergerannt." },
      { icon: "packages", name: "Arbeitspakete", role: "Das Set, die Edit, die Lieferung — in übernehmbare Teile geteilt." },
      { icon: "shotlist", name: "Shotlist", role: "Jeder Winkel und jedes Setup, am Set abgehakt." },
      { icon: "schedule", name: "Termine", role: "Shooting-Tag, Review-Call, Liefertermin — im Kontext." },
      { icon: "location", name: "Location", role: "Studio oder Set, für alle auf der Karte gepinnt." },
      { icon: "moodboard", name: "Moodboard", role: "Referenz und Inspiration in einem Rahmen." },
      { icon: "files", name: "Dateien", role: "Briefings, Verträge, Specs — angehängt, wo sie hingehören." },
      { icon: "notes", name: "Notizen", role: "Alles, was in keine Box passt." },
      { icon: "qa", name: "Fragen & Antworten", role: "Offene Fragen, die Kunde oder Team beantworten." },
      { icon: "discussion", name: "Diskussion", role: "Das laufende Gespräch, direkt neben der Arbeit." },
    ],
    footnote: "…und mehr — MAGYC wählt, konfiguriert und ordnet sie für jeden Auftrag.",
  },
  present: {
    ...PRESENT_SHARED,
    sub:
      "Die Location, die Crew, die Deliverables, die finalen Selects — schon im System. Ein Klick setzt daraus eine gebrandete Recap- und Übergabe-Seite zusammen. Farben und ein paar Worte anpassen; im Grunde fertig.",
  },
  positioning: POSITIONING,
  cta: { headline: "Starte dein nächstes Shooting in MAGYC.", button: "Kostenlos testen" },
};

// ── Corporate / Business — the closest adjacent segment ───────────────
const CORPORATE: Segment = {
  slug: "corporate",
  label: "Corporate-Fotografie",
  meta: {
    title: "MAGYC für Corporate-Fotografie",
    description:
      "Headshot-Tage, mehrere Standorte, viele Ansprechpartner, Nutzungsrechte, ein konsistenter Look. MAGYC trägt das ganze Projekt — von der HR-Mail bis zur Übergabe.",
  },
  hero: {
    eyebrow: "Für Corporate- & Business-Fotografie",
    headline: "Die Aufnahme dauert Minuten. Die Abstimmung dauert Wochen.",
    sub:
      "Headshot-Tage über mehrere Standorte, ein Dutzend Ansprechpartner, Nutzungsrechte und ein konsistenter Look übers ganze Unternehmen. MAGYC macht aus der Mail von HR oder Marketing ein gemeinsames Projekt — und aus den fertigen Bildern eine saubere Übergabe für alle Beteiligten.",
    ctaPrimary: "Projekt starten",
    ctaSecondary: "Beispielprojekt ansehen →",
    placeholderLabel: "Corporate-Shooting · Hero",
  },
  problem: {
    eyebrow: "Der eigentliche Job",
    heading: "Das Schwierige am Corporate-Shooting ist nicht das Licht.",
    cards: [
      { big: "Viele Ansprechpartner", small: "HR, Marketing, Office, Geschäftsführung — jeder redet mit, keiner hat den Überblick." },
      { big: "Rechte & Konsistenz", small: "Wohin dürfen die Bilder, wie lange — und sieht in jedem Office am Ende alles gleich aus?" },
      { big: "Termine über Standorte", small: "Headshot-Tage, Verfügbarkeiten, Räume — die Logistik frisst mehr Zeit als das Shooting." },
    ],
  },
  work: {
    eyebrow: "Gemacht für Arbeit wie diese",
    heading: "Vom Headshot übers Team bis zum Office.",
    lead: "MAGYC trägt das Projekt — du machst die Bilder.",
    placeholderLabels: ["Headshot", "Team", "Porträt", "Office", "Standort", "Detail"],
    footnote: "Echte Corporate-Bilder · folgen (keine Stockbilder)",
  },
  lifecycle: {
    eyebrow: "Ein Projekt, drei Phasen",
    heading: "Dasselbe Projekt — von der HR-Mail bis zur Übergabe getragen.",
    steps: [
      { n: "01", title: "Briefing", lead: "Leite die Mail von HR oder Marketing weiter. MAGYC liest mit und baut das Projekt: zu fotografierende Personen, Standorte, Nutzungsrechte, Termine, Ansprechpartner.", note: "Das Briefing lebt nicht mehr im Mail-Verlauf." },
      { n: "02", title: "Produktion", lead: "Ein gemeinsamer Raum für alle Beteiligten. HR, Marketing und Team sehen Aufnahmeliste, Termine und offene Fragen — Freigaben laufen, ohne dass du hinterhertelefonierst.", note: "Ein Ort statt zwanzig Mail-Threads." },
      { n: "03", title: "Übergabe", lead: "Sind die Bilder fertig, macht ein Klick aus demselben Projekt eine gebrandete Übergabe-Seite — mit den richtigen Formaten und Nutzungshinweisen für jede Abteilung.", note: "Eine saubere Quelle für das ganze Unternehmen." },
    ],
  },
  blocks: {
    eyebrow: "Die Bausteine",
    heading: "Kein Template. Ein Baukasten aus kleinen, scharfen Teilen.",
    lead: "MAGYC setzt jedes Projekt aus fokussierten Bausteinen zusammen und wählt die, die dein Auftrag wirklich braucht — statt ihn in eine starre Form zu pressen.",
    items: [
      { icon: "deliverables", name: "Deliverables", role: "Headshots, Web- und Print-Formate, Größen pro Abteilung." },
      { icon: "approvals", name: "Freigaben", role: "Sign-off von HR, Marketing und Geschäftsführung — nachvollziehbar." },
      { icon: "crew", name: "Ansprechpartner", role: "Wer entscheidet was — HR, Marketing, Office an einem Ort." },
      { icon: "shotlist", name: "Aufnahmeliste", role: "Jede Person, jedes Team, jeder Raum — am Tag abgehakt." },
      { icon: "schedule", name: "Termine", role: "Headshot-Slots und Verfügbarkeiten über alle Standorte." },
      { icon: "location", name: "Standorte", role: "Mehrere Offices, für alle auf der Karte gepinnt." },
      { icon: "packages", name: "Arbeitspakete", role: "Pro Standort oder Abteilung — in übernehmbare Teile geteilt." },
      { icon: "files", name: "Dateien", role: "Brand-Guidelines, Verträge, Einverständnisse — wo sie hingehören." },
      { icon: "moodboard", name: "Moodboard", role: "Der gewünschte Look, für alle Beteiligten sichtbar." },
      { icon: "notes", name: "Notizen", role: "Alles, was in keine Box passt." },
      { icon: "qa", name: "Fragen & Antworten", role: "Offene Fragen, die HR oder Team beantworten." },
      { icon: "discussion", name: "Diskussion", role: "Das laufende Gespräch, direkt neben der Arbeit." },
    ],
    footnote: "…und mehr — MAGYC wählt, konfiguriert und ordnet sie für jeden Auftrag.",
  },
  present: {
    ...PRESENT_SHARED,
    heading: "Dasselbe Projekt, neu geboren als Übergabe.",
    sub:
      "Die Standorte, die Ansprechpartner, die Formate, die finalen Bilder — schon im System. Ein Klick setzt daraus eine gebrandete Übergabe-Seite zusammen, die jede Abteilung versteht. Farben und ein paar Worte anpassen; im Grunde fertig.",
  },
  positioning: POSITIONING,
  cta: { headline: "Starte dein nächstes Corporate-Shooting in MAGYC.", button: "Kostenlos testen" },
};

export const SEGMENTS: Segment[] = [PRODUCT, CORPORATE];

export function segmentBySlug(slug: string): Segment | undefined {
  return SEGMENTS.find((s) => s.slug === slug);
}
