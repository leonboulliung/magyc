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
import { normalizeLocale } from "@/lib/i18n/locale";

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
      { icon: "qa", name: "Offene Fragen", role: "Klärungsbedarf bleibt direkt am Projekt sichtbar." },
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
      { icon: "qa", name: "Offene Fragen", role: "Klärungsbedarf bleibt direkt am Projekt sichtbar." },
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

// ── Event — bottleneck: speed, volume, fast delivery ──────────────────
const EVENT: Segment = {
  slug: "event",
  label: "Eventfotografie",
  meta: {
    title: "MAGYC für Eventfotografie",
    description:
      "Hunderte Bilder, viele Beteiligte, Lieferung gegen die Uhr. MAGYC trägt das Event-Projekt — von den Eckdaten bis zur Galerie am selben Abend.",
  },
  hero: {
    eyebrow: "Für Event- & Veranstaltungsfotografie",
    headline: "Das Event ist vorbei, bevor die Galerie online ist?",
    sub:
      "Hunderte Bilder, ein Dutzend Must-have-Motive, Veranstalter und Sponsoren mit eigenen Wünschen — und alle wollen schnell liefern. MAGYC macht aus den Event-Eckdaten ein gemeinsames Projekt und aus dem fertigen Tag eine Galerie, oft noch am selben Abend.",
    ctaPrimary: "Projekt starten",
    ctaSecondary: "Beispielprojekt ansehen →",
    image: { src: "/media/showcase-05.jpg", alt: "Event in einer großen Halle", caption: "Event · Veranstaltung" },
  },
  problem: {
    eyebrow: "Der eigentliche Job",
    heading: "Bei Events gewinnt, wer zuerst liefert.",
    cards: [
      { big: "Hunderte Bilder", small: "in Stunden, nicht Tagen — Auswahl, Tagging und Freigabe unter Zeitdruck." },
      { big: "Viele Beteiligte", small: "Veranstalter, Agentur, Sponsoren — jeder will andere Motive, und zwar schnell." },
      { big: "Lieferung gegen die Uhr", small: "Pressefotos, Social-Cuts, Galerie — am besten noch am selben Abend." },
    ],
  },
  work: {
    eyebrow: "Gemacht für Arbeit wie diese",
    heading: "Von der Bühne bis ins Publikum.",
    lead: "MAGYC trägt das Projekt — du machst die Bilder.",
    placeholderLabels: ["Bühne", "Publikum", "Speaker", "Networking", "Detail", "Catering"],
    footnote: "Echte Event-Bilder · folgen (keine Stockbilder)",
  },
  lifecycle: {
    eyebrow: "Ein Projekt, drei Phasen",
    heading: "Dasselbe Projekt — von den Eckdaten bis zur Galerie getragen.",
    steps: [
      { n: "01", title: "Briefing", lead: "Event-Eckdaten rein: Programm, Must-have-Motive, Sponsoren-Wünsche, Deadlines. MAGYC baut daraus das Projekt.", note: "Alle Wünsche an einem Ort, nicht in zehn Mails." },
      { n: "02", title: "Produktion", lead: "Ein gemeinsamer Raum für den Tag — Shotlist, Sponsoren-Motive und schnelle Freigaben, während es läuft.", note: "Keine vergessene Pflichtaufnahme." },
      { n: "03", title: "Übergabe", lead: "Ist der Tag im Kasten, macht ein Klick aus demselben Projekt eine gebrandete Galerie mit den richtigen Formaten.", note: "Schnelle Lieferung statt nächtelanger Handarbeit." },
    ],
  },
  blocks: {
    eyebrow: "Die Bausteine",
    heading: "Kein Template. Ein Baukasten aus kleinen, scharfen Teilen.",
    lead: "MAGYC setzt jedes Projekt aus fokussierten Bausteinen zusammen und wählt die, die dein Event wirklich braucht — statt es in eine starre Form zu pressen.",
    items: [
      { icon: "deliverables", name: "Deliverables", role: "Pressefotos, Social-Formate, Galerie-Mengen — klar definiert." },
      { icon: "shotlist", name: "Shotlist", role: "Must-have-Motive: Bühne, Keynote, Sponsoren — am Tag abgehakt." },
      { icon: "schedule", name: "Programm", role: "Programmpunkte und Slots — wann was passiert." },
      { icon: "approvals", name: "Freigaben", role: "Schnelle Sign-offs von Veranstalter und Agentur." },
      { icon: "crew", name: "Team & Kontakte", role: "Wer vor Ort entscheidet — Veranstalter, Agentur, Sponsoren." },
      { icon: "location", name: "Location", role: "Venue, für alle auf der Karte gepinnt." },
      { icon: "packages", name: "Arbeitspakete", role: "Tag, Auswahl, Lieferung — in übernehmbare Teile geteilt." },
      { icon: "files", name: "Dateien", role: "Ablaufplan, Sponsoren-Logos, Specs — wo sie hingehören." },
      { icon: "moodboard", name: "Moodboard", role: "Der gewünschte Look des Events." },
      { icon: "notes", name: "Notizen", role: "Alles, was in keine Box passt." },
      { icon: "qa", name: "Fragen & Antworten", role: "Offene Fragen, die der Veranstalter beantwortet." },
      { icon: "qa", name: "Offene Fragen", role: "Klärungsbedarf bleibt direkt am Projekt sichtbar." },
    ],
    footnote: "…und mehr — MAGYC wählt, konfiguriert und ordnet sie für jeden Auftrag.",
  },
  present: {
    ...PRESENT_SHARED,
    heading: "Dasselbe Projekt, neu geboren als Galerie.",
    sub:
      "Das Programm, die Beteiligten, die Pflichtmotive, die besten Bilder — schon im System. Ein Klick setzt daraus eine gebrandete Galerie zusammen, in den richtigen Formaten. Farben und ein paar Worte anpassen; im Grunde fertig.",
  },
  positioning: POSITIONING,
  cta: { headline: "Starte dein nächstes Event in MAGYC.", button: "Kostenlos testen" },
};

// ── Wedding — bottleneck: end-to-end consistency, one-shot day ─────────
const WEDDING: Segment = {
  slug: "wedding",
  label: "Hochzeitsfotografie",
  meta: {
    title: "MAGYC für Hochzeitsfotografie",
    description:
      "Ein Tag, kein zweiter Versuch. MAGYC hält Ablauf, Gruppenfoto-Listen, Beteiligte und Wünsche zusammen — vom Erstgespräch bis zur Galerie fürs Paar.",
  },
  hero: {
    eyebrow: "Für Hochzeitsfotografie",
    headline: "Ein Tag, der nicht wiederholbar ist.",
    sub:
      "Getting-ready bis zum letzten Tanz, zwei Familien, Gruppenfoto-Listen, mehrere Locations und Vendors. MAGYC hält Ablauf, Wünsche und Beteiligte an einem Ort zusammen — vom Erstgespräch bis zur fertigen Galerie fürs Paar.",
    ctaPrimary: "Projekt starten",
    ctaSecondary: "Beispielprojekt ansehen →",
    image: { src: "/media/showcase-06.jpg", alt: "Brautpaar Hand in Hand", caption: "Hochzeit" },
  },
  problem: {
    eyebrow: "Der eigentliche Job",
    heading: "Eine Hochzeit verzeiht keinen verpassten Moment.",
    cards: [
      { big: "Ein Zeitplan, kein zweiter Versuch", small: "Getting-ready bis Tanz — jeder Programmpunkt zählt, nichts darf untergehen." },
      { big: "Familien & Wünsche", small: "Gruppenfoto-Listen, Sonderwünsche, Ansprechpartner auf beiden Seiten." },
      { big: "Vom Erstgespräch zur Übergabe", small: "Monate zwischen Buchung und Galerie — alles an einem Ort statt im Postfach." },
    ],
  },
  work: {
    eyebrow: "Gemacht für Arbeit wie diese",
    heading: "Vom ersten Blick bis zum letzten Tanz.",
    lead: "MAGYC trägt das Projekt — du machst die Bilder.",
    placeholderLabels: ["Trauung", "Paar", "Details", "Gruppen", "Feier", "Location"],
    footnote: "Echte Hochzeitsbilder · folgen (keine Stockbilder)",
  },
  lifecycle: {
    eyebrow: "Ein Projekt, drei Phasen",
    heading: "Dasselbe Projekt — vom Erstgespräch bis zur Galerie getragen.",
    steps: [
      { n: "01", title: "Briefing", lead: "Aus dem Erstgespräch wird das Projekt: Ablaufplan, Gruppenfoto-Liste, Locations, Vendors, Sonderwünsche.", note: "Das Vorgespräch lebt nicht mehr im Postfach." },
      { n: "02", title: "Produktion", lead: "Ein gemeinsamer Raum: Timeline, Wunschliste und Ansprechpartner — am großen Tag und in den Wochen davor.", note: "Nichts geht im Trubel verloren." },
      { n: "03", title: "Übergabe", lead: "Ist alles im Kasten, macht ein Klick aus demselben Projekt eine gebrandete Galerie fürs Paar.", note: "Eine Übergabe, die sich besonders anfühlt." },
    ],
  },
  blocks: {
    eyebrow: "Die Bausteine",
    heading: "Kein Template. Ein Baukasten aus kleinen, scharfen Teilen.",
    lead: "MAGYC setzt jedes Projekt aus fokussierten Bausteinen zusammen und wählt die, die deine Hochzeit wirklich braucht — statt sie in eine starre Form zu pressen.",
    items: [
      { icon: "schedule", name: "Ablaufplan", role: "Getting-ready bis Tanz — jeder Programmpunkt im Blick." },
      { icon: "shotlist", name: "Gruppenfoto-Liste", role: "Jede Konstellation, am Tag abgehakt." },
      { icon: "crew", name: "Beteiligte", role: "Trauzeugen, Planer, Vendors — wer was macht." },
      { icon: "location", name: "Locations", role: "Kirche, Location, Fotospots — auf der Karte." },
      { icon: "deliverables", name: "Deliverables", role: "Vorschau, Galerie, Album — Mengen und Formate." },
      { icon: "approvals", name: "Vorauswahl", role: "Das Paar markiert Favoriten und gibt frei." },
      { icon: "moodboard", name: "Stil & Vorbilder", role: "Der gewünschte Look, für alle sichtbar." },
      { icon: "files", name: "Dateien", role: "Verträge, Ablauf, Wunschlisten — wo sie hingehören." },
      { icon: "packages", name: "Arbeitspakete", role: "Tag, Auswahl, Album — in übernehmbare Teile geteilt." },
      { icon: "notes", name: "Notizen", role: "Alles, was in keine Box passt." },
      { icon: "qa", name: "Fragen & Antworten", role: "Offene Fragen, die das Paar beantwortet." },
      { icon: "qa", name: "Offene Fragen", role: "Klärungsbedarf bleibt direkt am Projekt sichtbar." },
    ],
    footnote: "…und mehr — MAGYC wählt, konfiguriert und ordnet sie für jeden Auftrag.",
  },
  present: {
    ...PRESENT_SHARED,
    heading: "Dasselbe Projekt, neu geboren als Galerie fürs Paar.",
    sub:
      "Der Ablauf, die Beteiligten, die Locations, die schönsten Bilder — schon im System. Ein Klick setzt daraus eine gebrandete Galerie fürs Paar zusammen. Farben und ein paar Worte anpassen; im Grunde fertig.",
  },
  positioning: POSITIONING,
  cta: { headline: "Starte deine nächste Hochzeit in MAGYC.", button: "Kostenlos testen" },
};

// ── Fashion / Editorial — bottleneck: crew, looks, usage ──────────────
const FASHION: Segment = {
  slug: "fashion",
  label: "Fashionfotografie",
  meta: {
    title: "MAGYC für Fashion- & Editorial-Fotografie",
    description:
      "Model, Styling, MUA, Art-Direction, Looks und Nutzungsrechte. MAGYC hält Crew, Referenzen und Freigaben zusammen — vom Konzept bis zur fertigen Strecke.",
  },
  hero: {
    eyebrow: "Für Fashion- & Editorial-Fotografie",
    headline: "Ein Look entsteht nicht allein.",
    sub:
      "Model, Styling, Make-up, Art-Direction — alle müssen denselben Look kennen, am selben Tag, unter Zeitdruck. MAGYC hält Looks, Crew, Referenzen und Freigaben zusammen — vom Konzept bis zur ausgelieferten Strecke.",
    ctaPrimary: "Projekt starten",
    ctaSecondary: "Beispielprojekt ansehen →",
    image: { src: "/media/showcase-09.jpg", alt: "Editorial-Porträt im Schattenwurf", caption: "Editorial" },
  },
  problem: {
    eyebrow: "Der eigentliche Job",
    heading: "Fashion ist Teamarbeit unter Zeitdruck.",
    cards: [
      { big: "Viele Gewerke", small: "Model, Styling, MUA, Art-Director — alle müssen denselben Look kennen." },
      { big: "Looks & Referenzen", small: "Outfits, Stimmungen, Posen — verstreut über Chats und Boards." },
      { big: "Rechte & Auslieferung", small: "Wer darf die Bilder wie nutzen — und in welchen Formaten?" },
    ],
  },
  work: {
    eyebrow: "Gemacht für Arbeit wie diese",
    heading: "Vom Konzept bis zur Strecke.",
    lead: "MAGYC trägt das Projekt — du machst die Bilder.",
    images: [
      { src: "/media/showcase-03.jpg", alt: "Editorial-Porträt, schwarzer Blazer" },
      { src: "/media/showcase-07.jpg", alt: "Modeporträt in Rot vor blauem Himmel" },
    ],
    footnote: "Beispielhafte Editorial-Fotografie",
  },
  lifecycle: {
    eyebrow: "Ein Projekt, drei Phasen",
    heading: "Dasselbe Projekt — vom Konzept bis zur Strecke getragen.",
    steps: [
      { n: "01", title: "Konzept", lead: "Aus der Idee wird das Projekt: Looks, Crew, Referenzen, Nutzungsrechte, Termin und Location.", note: "Ein geteiltes Konzept statt verstreuter Boards." },
      { n: "02", title: "Produktion", lead: "Ein gemeinsamer Raum am Set: Looks, Crew, Referenzen und Freigaben — alle sehen denselben Stand.", note: "Jeder kennt den Look." },
      { n: "03", title: "Übergabe", lead: "Ist die Strecke fertig, macht ein Klick aus demselben Projekt ein gebrandetes Lookbook mit klaren Nutzungshinweisen.", note: "Von der Planung zur Strecke, automatisch." },
    ],
  },
  blocks: {
    eyebrow: "Die Bausteine",
    heading: "Kein Template. Ein Baukasten aus kleinen, scharfen Teilen.",
    lead: "MAGYC setzt jedes Projekt aus fokussierten Bausteinen zusammen und wählt die, die deine Strecke wirklich braucht — statt sie in eine starre Form zu pressen.",
    items: [
      { icon: "crew", name: "Crew", role: "Model, Styling, MUA, Art-Director — geclaimt, nicht hinterhergerannt." },
      { icon: "moodboard", name: "Looks & Referenzen", role: "Outfits, Stimmungen, Posen — in einem Rahmen." },
      { icon: "shotlist", name: "Looks & Shotlist", role: "Jeder Look und jedes Setup, am Set abgehakt." },
      { icon: "deliverables", name: "Deliverables", role: "Strecke, Formate, Nutzungsrechte — klar definiert." },
      { icon: "approvals", name: "Freigaben", role: "Sign-off von Art-Director und Kunde." },
      { icon: "schedule", name: "Termine", role: "Looks-Timing, Shooting-Tag, Liefertermin." },
      { icon: "location", name: "Location", role: "Studio oder Set, für alle auf der Karte." },
      { icon: "files", name: "Dateien", role: "Usage, Verträge, Releases — wo sie hingehören." },
      { icon: "packages", name: "Arbeitspakete", role: "Set, Edit, Lieferung — in übernehmbare Teile geteilt." },
      { icon: "notes", name: "Notizen", role: "Alles, was in keine Box passt." },
      { icon: "qa", name: "Fragen & Antworten", role: "Offene Fragen, die der Kunde beantwortet." },
      { icon: "qa", name: "Offene Fragen", role: "Klärungsbedarf bleibt direkt am Projekt sichtbar." },
    ],
    footnote: "…und mehr — MAGYC wählt, konfiguriert und ordnet sie für jeden Auftrag.",
  },
  present: {
    ...PRESENT_SHARED,
    heading: "Dasselbe Projekt, neu geboren als Strecke.",
    sub:
      "Die Crew, die Looks, die Referenzen, die finalen Bilder — schon im System. Ein Klick setzt daraus ein gebrandetes Lookbook zusammen. Farben und ein paar Worte anpassen; im Grunde fertig.",
  },
  positioning: POSITIONING,
  cta: { headline: "Starte deine nächste Strecke in MAGYC.", button: "Kostenlos testen" },
};

const POSITIONING_EN = {
  eyebrow: "Where AI helps",
  heading: "AI handles the admin. You keep the craft.",
  sub:
    "MAGYC does not touch your images or your style. It takes over structure, admin and handover — the invisible hours between shoots. The shoot stays yours, and so does the final decision.",
};

const PRESENT_SHARED_EN = {
  eyebrow: "When the shoot is clear",
  heading: "The same project, reborn as a presentation.",
  fromLabel: "PLAN",
  toLabel: "PRESENT",
  mediaLabel: "Auto-generated presentation page",
  mediaCaption: "Annotated example · coming soon",
};

const PRODUCT_EN: Segment = {
  slug: "product",
  label: "Product photography",
  meta: {
    title: "MAGYC for product photographers",
    description:
      "From the first client email to the final handover — one place that forms around the shoot. Enter it once; never retype the same briefing again.",
  },
  hero: {
    eyebrow: "For product & commercial photographers",
    headline: "The photo is the easy part.",
    sub:
      "The briefing, usage rights, shotlist, approvals and handover are where margin appears or disappears. MAGYC turns the first client email into a shared project and the finished shoot into a clean presentation.",
    ctaPrimary: "Start project",
    ctaSecondary: "View example project →",
    image: { src: "/media/hero-bts.jpg", alt: "Product shoot in a dark studio with tethered camera, laptop and sweep", caption: "Set · Product shoot" },
  },
  problem: {
    eyebrow: "The real job",
    heading: "A commercial shoot is a coordination problem with a camera.",
    cards: [
      { big: "2–6 tools", small: "CRM, gallery, email, spreadsheet, contract — and the same data gets typed into each one." },
      { big: "Invisible hours", small: "Briefing, usage rights, approvals and delivery setup quietly eat into the margin." },
      { big: "Built again every time", small: "The handover and case study are assembled by hand after every project." },
    ],
  },
  work: {
    eyebrow: "Made for work like this",
    heading: "From still life to beauty to tech.",
    lead: "MAGYC carries the project — you make the images.",
    images: PRODUCT.work.images,
    footnote: "Example product photography · no stock images",
  },
  lifecycle: {
    eyebrow: "One project, three phases",
    heading: "The same project — carried from briefing to handover.",
    steps: [
      { n: "01", title: "Briefing", lead: "Forward the client email or type the job in one sentence. MAGYC builds deliverables, usage, shoot date, location and crew.", note: "The briefing no longer lives in the inbox." },
      { n: "02", title: "Production", lead: "A shared room for the shoot. Client, assistants, styling and retouching work in the same structure.", note: "Everyone sees the same truth." },
      { n: "03", title: "Presentation", lead: "When the shoot is done, one click turns the same project into a branded handover page.", note: "From planning surface to presentation, automatically." },
    ],
  },
  blocks: {
    eyebrow: "The building blocks",
    heading: "No template. A kit of small, sharp parts.",
    lead: "MAGYC assembles each project from focused blocks and chooses what your shoot actually needs.",
    items: [
      { icon: "deliverables", name: "Deliverables", role: "Every asset, format and quantity the client expects." },
      { icon: "approvals", name: "Approvals", role: "Sign-off points the client or team can confirm." },
      { icon: "crew", name: "Crew & roles", role: "Assistant, styling, retouching, agency — claimed, not chased." },
      { icon: "packages", name: "Work packages", role: "Set, edit and delivery split into manageable parts." },
      { icon: "shotlist", name: "Shotlist", role: "Every angle and setup, checked off on set." },
      { icon: "schedule", name: "Dates", role: "Shoot day, review call and delivery date in context." },
      { icon: "location", name: "Location", role: "Studio or set pinned on the map." },
      { icon: "moodboard", name: "Moodboard", role: "References and inspiration in one frame." },
      { icon: "files", name: "Files", role: "Briefings, contracts and specs attached where they belong." },
      { icon: "notes", name: "Notes", role: "Everything that does not fit a box." },
      { icon: "qa", name: "Q&A", role: "Open questions answered by client or team." },
      { icon: "qa", name: "Open questions", role: "Clarification stays visible directly on the project." },
    ],
    footnote: "…and more — MAGYC chooses, configures and orders them for each job.",
  },
  present: {
    ...PRESENT_SHARED_EN,
    sub: "Locations, crew, deliverables and final selects are already in the system. One click turns them into a branded recap and handover page.",
  },
  positioning: POSITIONING_EN,
  cta: { headline: "Start your next shoot in MAGYC.", button: "Try for free" },
};

const CORPORATE_EN: Segment = {
  slug: "corporate",
  label: "Corporate photography",
  meta: {
    title: "MAGYC for corporate photography",
    description:
      "Headshot days, multiple locations, many stakeholders, usage rights and a consistent look. MAGYC carries the whole project.",
  },
  hero: {
    eyebrow: "For corporate & business photography",
    headline: "The portrait takes minutes. The coordination takes weeks.",
    sub:
      "Headshot days across locations, HR and marketing stakeholders, usage rights and one consistent look. MAGYC turns the first email into a shared project and the finished images into a clean handover.",
    ctaPrimary: "Start project",
    ctaSecondary: "View example project →",
    placeholderLabel: "Corporate shoot · Hero",
  },
  problem: {
    eyebrow: "The real job",
    heading: "The hard part of a corporate shoot is not the light.",
    cards: [
      { big: "Many stakeholders", small: "HR, marketing, office, management — everyone is involved, nobody has the full overview." },
      { big: "Rights & consistency", small: "Where may the images be used, for how long, and does every office look consistent?" },
      { big: "Dates across locations", small: "Headshot days, availability and rooms take more time than the shoot." },
    ],
  },
  work: {
    eyebrow: "Made for work like this",
    heading: "From headshots to teams to offices.",
    lead: "MAGYC carries the project — you make the images.",
    placeholderLabels: ["Headshot", "Team", "Portrait", "Office", "Location", "Detail"],
    footnote: "Real corporate images · coming soon",
  },
  lifecycle: {
    eyebrow: "One project, three phases",
    heading: "The same project — from HR email to handover.",
    steps: [
      { n: "01", title: "Briefing", lead: "Forward the email from HR or marketing. MAGYC builds people, locations, rights, dates and contacts.", note: "The briefing no longer lives in an email thread." },
      { n: "02", title: "Production", lead: "A shared room for everyone involved: shot list, dates, open questions and approvals.", note: "One place instead of twenty email threads." },
      { n: "03", title: "Handover", lead: "When the images are ready, the same project becomes a branded handover page with the right formats and usage notes.", note: "One clean source for the whole company." },
    ],
  },
  blocks: {
    eyebrow: "The building blocks",
    heading: "No template. A kit of small, sharp parts.",
    lead: "MAGYC assembles each project from focused blocks and chooses what this job actually needs.",
    items: [
      { icon: "deliverables", name: "Deliverables", role: "Headshots, web and print formats, quantities by department." },
      { icon: "approvals", name: "Approvals", role: "Sign-off from HR, marketing and management." },
      { icon: "crew", name: "Contacts", role: "Who decides what — HR, marketing and office in one place." },
      { icon: "shotlist", name: "Shot list", role: "Every person, team and room checked off on the day." },
      { icon: "schedule", name: "Dates", role: "Headshot slots and availability across locations." },
      { icon: "location", name: "Locations", role: "Multiple offices pinned on the map." },
      { icon: "packages", name: "Work packages", role: "By location or department." },
      { icon: "files", name: "Files", role: "Brand guidelines, contracts and releases where they belong." },
      { icon: "moodboard", name: "Moodboard", role: "The desired look, visible to everyone." },
      { icon: "notes", name: "Notes", role: "Everything that does not fit a box." },
      { icon: "qa", name: "Q&A", role: "Open questions answered by HR or team." },
      { icon: "qa", name: "Open questions", role: "Clarification stays visible directly on the project." },
    ],
    footnote: "…and more — MAGYC chooses, configures and orders them for each job.",
  },
  present: { ...PRESENT_SHARED_EN, heading: "The same project, reborn as a handover.", sub: "Locations, contacts, formats and final images are already in the system. One click creates a branded handover page every department understands." },
  positioning: POSITIONING_EN,
  cta: { headline: "Start your next corporate shoot in MAGYC.", button: "Try for free" },
};

const EVENT_EN: Segment = {
  slug: "event",
  label: "Event photography",
  meta: { title: "MAGYC for event photography", description: "Hundreds of images, many stakeholders, delivery against the clock. MAGYC carries the event project from key facts to gallery." },
  hero: {
    eyebrow: "For event photography",
    headline: "The event is over before the gallery is online?",
    sub: "Hundreds of images, must-have moments, organisers and sponsors with their own needs — and everyone wants fast delivery. MAGYC turns event details into a shared project and the finished day into a gallery.",
    ctaPrimary: "Start project",
    ctaSecondary: "View example project →",
    image: { src: "/media/showcase-05.jpg", alt: "Event in a large hall", caption: "Event" },
  },
  problem: { eyebrow: "The real job", heading: "Events reward whoever delivers first.", cards: [
    { big: "Hundreds of images", small: "In hours, not days — selection, tagging and approval under pressure." },
    { big: "Many stakeholders", small: "Organiser, agency, sponsors — everyone needs different images quickly." },
    { big: "Delivery against the clock", small: "Press photos, social cuts and gallery, ideally the same evening." },
  ] },
  work: { eyebrow: "Made for work like this", heading: "From stage to audience.", lead: "MAGYC carries the project — you make the images.", placeholderLabels: ["Stage", "Audience", "Speaker", "Networking", "Detail", "Catering"], footnote: "Real event images · coming soon" },
  lifecycle: { eyebrow: "One project, three phases", heading: "The same project — from key facts to gallery.", steps: [
    { n: "01", title: "Briefing", lead: "Event facts in: schedule, must-have shots, sponsor needs and deadlines. MAGYC builds the project.", note: "All wishes in one place." },
    { n: "02", title: "Production", lead: "A shared room for the day — shotlist, sponsor images and fast approvals while it is happening.", note: "No required shot forgotten." },
    { n: "03", title: "Handover", lead: "When the day is captured, one click turns the project into a branded gallery with the right formats.", note: "Fast delivery instead of night work." },
  ] },
  blocks: { eyebrow: "The building blocks", heading: "No template. A kit of small, sharp parts.", lead: "MAGYC assembles each project from focused blocks and chooses what your event actually needs.", items: [
    { icon: "deliverables", name: "Deliverables", role: "Press photos, social formats and gallery quantities." },
    { icon: "shotlist", name: "Shotlist", role: "Must-have moments checked off during the event." },
    { icon: "schedule", name: "Programme", role: "Agenda points and slots in context." },
    { icon: "approvals", name: "Approvals", role: "Fast sign-offs from organiser and agency." },
    { icon: "crew", name: "Team & contacts", role: "Who decides on site." },
    { icon: "location", name: "Location", role: "Venue pinned on the map." },
    { icon: "packages", name: "Work packages", role: "Day, selection and delivery split clearly." },
    { icon: "files", name: "Files", role: "Schedule, sponsor logos and specs." },
    { icon: "moodboard", name: "Moodboard", role: "The desired event look." },
    { icon: "notes", name: "Notes", role: "Everything that does not fit a box." },
    { icon: "qa", name: "Q&A", role: "Open questions answered by the organiser." },
    { icon: "qa", name: "Open questions", role: "Clarification stays visible directly on the project." },
  ], footnote: "…and more — MAGYC chooses, configures and orders them for each job." },
  present: { ...PRESENT_SHARED_EN, heading: "The same project, reborn as a gallery.", sub: "The programme, people, required shots and best images are already in the system. One click creates a branded gallery." },
  positioning: POSITIONING_EN,
  cta: { headline: "Start your next event in MAGYC.", button: "Try for free" },
};

const WEDDING_EN: Segment = {
  slug: "wedding",
  label: "Wedding photography",
  meta: { title: "MAGYC for wedding photography", description: "One day, no second attempt. MAGYC keeps timeline, group lists, people and wishes together." },
  hero: {
    eyebrow: "For wedding photography",
    headline: "A day that cannot be repeated.",
    sub: "From getting ready to the last dance: families, group photo lists, locations and vendors. MAGYC keeps timeline, wishes and people together from first call to gallery.",
    ctaPrimary: "Start project",
    ctaSecondary: "View example project →",
    image: { src: "/media/showcase-06.jpg", alt: "Wedding couple holding hands", caption: "Wedding" },
  },
  problem: { eyebrow: "The real job", heading: "A wedding does not forgive missed moments.", cards: [
    { big: "One timeline", small: "From getting ready to dance — every point matters." },
    { big: "Families & wishes", small: "Group lists, special wishes and contacts on both sides." },
    { big: "Months of context", small: "Everything stays in one place between booking and gallery." },
  ] },
  work: { eyebrow: "Made for work like this", heading: "From first look to last dance.", lead: "MAGYC carries the project — you make the images.", placeholderLabels: ["Ceremony", "Couple", "Details", "Groups", "Party", "Location"], footnote: "Real wedding images · coming soon" },
  lifecycle: { eyebrow: "One project, three phases", heading: "The same project — from first call to gallery.", steps: [
    { n: "01", title: "Briefing", lead: "From the first conversation: timeline, group photo list, locations, vendors and special wishes.", note: "The planning call no longer lives in the inbox." },
    { n: "02", title: "Production", lead: "A shared room for timeline, wish list and contacts before and during the day.", note: "Nothing gets lost in the rush." },
    { n: "03", title: "Handover", lead: "When everything is captured, one click turns the project into a branded gallery for the couple.", note: "A handover that feels special." },
  ] },
  blocks: { eyebrow: "The building blocks", heading: "No template. A kit of small, sharp parts.", lead: "MAGYC assembles each project from focused blocks and chooses what your wedding actually needs.", items: [
    { icon: "schedule", name: "Timeline", role: "From getting ready to dance." },
    { icon: "shotlist", name: "Group photo list", role: "Every constellation checked off." },
    { icon: "crew", name: "People involved", role: "Witnesses, planner and vendors." },
    { icon: "location", name: "Locations", role: "Ceremony, venue and photo spots." },
    { icon: "deliverables", name: "Deliverables", role: "Preview, gallery, album, quantities and formats." },
    { icon: "approvals", name: "Preselection", role: "The couple marks favourites and approves." },
    { icon: "moodboard", name: "Style & references", role: "The desired look, visible to everyone." },
    { icon: "files", name: "Files", role: "Contracts, timeline and wish lists." },
    { icon: "packages", name: "Work packages", role: "Day, selection and album." },
    { icon: "notes", name: "Notes", role: "Everything that does not fit a box." },
    { icon: "qa", name: "Q&A", role: "Open questions answered by the couple." },
    { icon: "qa", name: "Open questions", role: "Clarification stays visible directly on the project." },
  ], footnote: "…and more — MAGYC chooses, configures and orders them for each job." },
  present: { ...PRESENT_SHARED_EN, heading: "The same project, reborn as a gallery for the couple.", sub: "Timeline, people, locations and best images are already in the system. One click creates a branded gallery." },
  positioning: POSITIONING_EN,
  cta: { headline: "Start your next wedding in MAGYC.", button: "Try for free" },
};

const FASHION_EN: Segment = {
  slug: "fashion",
  label: "Fashion photography",
  meta: { title: "MAGYC for fashion & editorial photography", description: "Model, styling, MUA, art direction, looks and rights. MAGYC keeps crew, references and approvals together." },
  hero: {
    eyebrow: "For fashion & editorial photography",
    headline: "A look is not created alone.",
    sub: "Model, styling, make-up and art direction all need the same look, on the same day, under pressure. MAGYC keeps looks, crew, references and approvals together.",
    ctaPrimary: "Start project",
    ctaSecondary: "View example project →",
    image: { src: "/media/showcase-09.jpg", alt: "Editorial portrait with shadow", caption: "Editorial" },
  },
  problem: { eyebrow: "The real job", heading: "Fashion is teamwork under time pressure.", cards: [
    { big: "Many crafts", small: "Model, styling, MUA, art director — everyone needs the same look." },
    { big: "Looks & references", small: "Outfits, moods and poses spread across chats and boards." },
    { big: "Rights & delivery", small: "Who may use the images, where, and in which formats?" },
  ] },
  work: { eyebrow: "Made for work like this", heading: "From concept to editorial.", lead: "MAGYC carries the project — you make the images.", images: FASHION.work.images, footnote: "Example editorial photography" },
  lifecycle: { eyebrow: "One project, three phases", heading: "The same project — from concept to editorial.", steps: [
    { n: "01", title: "Concept", lead: "From idea to project: looks, crew, references, rights, date and location.", note: "One shared concept instead of scattered boards." },
    { n: "02", title: "Production", lead: "A shared space on set: looks, crew, references and approvals.", note: "Everyone knows the look." },
    { n: "03", title: "Handover", lead: "When the editorial is finished, one click turns the project into a branded lookbook with usage notes.", note: "From planning to editorial, automatically." },
  ] },
  blocks: { eyebrow: "The building blocks", heading: "No template. A kit of small, sharp parts.", lead: "MAGYC assembles each project from focused blocks and chooses what your editorial actually needs.", items: [
    { icon: "crew", name: "Crew", role: "Model, styling, MUA and art direction." },
    { icon: "moodboard", name: "Looks & references", role: "Outfits, moods and poses in one frame." },
    { icon: "shotlist", name: "Looks & shotlist", role: "Every look and setup checked off." },
    { icon: "deliverables", name: "Deliverables", role: "Editorial, formats and usage rights." },
    { icon: "approvals", name: "Approvals", role: "Sign-off from art director and client." },
    { icon: "schedule", name: "Dates", role: "Look timing, shoot day and delivery." },
    { icon: "location", name: "Location", role: "Studio or set on the map." },
    { icon: "files", name: "Files", role: "Usage, contracts and releases." },
    { icon: "packages", name: "Work packages", role: "Set, edit and delivery." },
    { icon: "notes", name: "Notes", role: "Everything that does not fit a box." },
    { icon: "qa", name: "Q&A", role: "Open questions answered by the client." },
    { icon: "qa", name: "Open questions", role: "Clarification stays visible directly on the project." },
  ], footnote: "…and more — MAGYC chooses, configures and orders them for each job." },
  present: { ...PRESENT_SHARED_EN, heading: "The same project, reborn as an editorial.", sub: "Crew, looks, references and final images are already in the system. One click creates a branded lookbook." },
  positioning: POSITIONING_EN,
  cta: { headline: "Start your next editorial in MAGYC.", button: "Try for free" },
};

const SEGMENTS_EN: Segment[] = [PRODUCT_EN, EVENT_EN, WEDDING_EN, CORPORATE_EN, FASHION_EN];

// Order = adjacency (see docs/STRATEGY.md §11), matches USE_CASES in lib/site.ts.
export const SEGMENTS: Segment[] = [PRODUCT, EVENT, WEDDING, CORPORATE, FASHION];

export function segmentsForLocale(localeInput: unknown): Segment[] {
  return normalizeLocale(localeInput) === "en" ? SEGMENTS_EN : SEGMENTS;
}

export function segmentBySlug(slug: string, localeInput: unknown = "de"): Segment | undefined {
  return segmentsForLocale(localeInput).find((s) => s.slug === slug);
}
