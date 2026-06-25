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
      { icon: "qa", name: "MAGYC-Chat", role: "Das laufende Gespräch läuft im Chat neben der Arbeit." },
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
      { icon: "qa", name: "MAGYC-Chat", role: "Das laufende Gespräch läuft im Chat neben der Arbeit." },
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
      { icon: "qa", name: "MAGYC-Chat", role: "Das laufende Gespräch läuft im Chat neben der Arbeit." },
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
      { icon: "qa", name: "MAGYC-Chat", role: "Das laufende Gespräch läuft im Chat neben der Arbeit." },
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
      { icon: "qa", name: "MAGYC-Chat", role: "Das laufende Gespräch läuft im Chat neben der Arbeit." },
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

// Order = adjacency (see docs/STRATEGY.md §11), matches USE_CASES in lib/site.ts.
export const SEGMENTS: Segment[] = [PRODUCT, EVENT, WEDDING, CORPORATE, FASHION];

export function segmentBySlug(slug: string): Segment | undefined {
  return SEGMENTS.find((s) => s.slug === slug);
}
