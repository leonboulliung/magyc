import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { SiteImage } from "@/components/site/SiteImage";
import { EmergentBackdrop } from "@/components/site/EmergentBackdrop";

export const metadata: Metadata = {
  title: "MAGYC für Produktfotografen",
  description:
    "Von der ersten Kundenmail bis zur fertigen Übergabe — ein Ort, der sich um das Shooting herum aufbaut. Einmal eingeben; nie wieder dasselbe Briefing abtippen.",
};

/* ── Marketing-Texte an einem Ort, damit sie leicht zu iterieren sind ──
   Positionierung für den Beachhead Produkt-/Commercial-Fotografie (siehe
   docs/STRATEGY.md). Beschreibt die Produktvision ehrlich; der Present-Slot
   bleibt bewusst Platzhalter (das ist die künftige UI, kein Foto). */

const LIFECYCLE: { n: string; title: string; lead: string; note: string }[] = [
  {
    n: "01",
    title: "Briefing",
    lead:
      "Leite die Kundenmail weiter — oder tippe den Auftrag in einem Satz. MAGYC liest mit und baut das Projekt: Deliverables, Nutzung, Shooting-Termin, Location, Crew.",
    note: "Das Briefing lebt nicht mehr im Postfach.",
  },
  {
    n: "02",
    title: "Produktion",
    lead:
      "Ein gemeinsamer Raum fürs Shooting. Kunde, Assistenz, Styling und Retusche arbeiten in derselben Struktur — Shotlist, Freigaben und Feedback an einem Ort.",
    note: "Alle sehen dieselbe Wahrheit.",
  },
  {
    n: "03",
    title: "Präsentation",
    lead:
      "Ist das Shooting fertig, macht ein Klick aus demselben Projekt eine gebrandete Übergabe-Seite. Die Daten sind schon da — nichts neu zu bauen.",
    note: "Von der Planungs- zur Präsentationsfläche, automatisch.",
  },
];

const WORK: { src: string; alt: string }[] = [
  { src: "/media/work-watch.jpg", alt: "Luxusuhr auf schwarzem Samt" },
  { src: "/media/work-skincare.jpg", alt: "Skincare-Stillleben" },
  { src: "/media/work-sneaker.jpg", alt: "Sneaker-Hero auf dunklem Grund" },
  { src: "/media/work-tech.jpg", alt: "Mattschwarzes Tech-Gerät" },
  { src: "/media/work-coffee.jpg", alt: "Kaffee-Pour, moody" },
  { src: "/media/work-vase.jpg", alt: "Designer-Keramikvase im dunklen Interieur" },
];

type Block = { icon: ReactNode; name: string; role: string };

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);

const BLOCKS: Block[] = [
  { icon: <I d="M4 7l8-4 8 4-8 4-8-4z|M4 7v10l8 4 8-4V7|M12 11v10" />, name: "Deliverables", role: "Jedes Asset, Format und jede Menge, die der Kunde erwartet." },
  { icon: <I d="M4 12l5 5L20 6" />, name: "Freigaben", role: "Sign-off-Punkte, die der Kunde abhakt — Kunde oder intern." },
  { icon: <I d="M9 8a3 3 0 1 0 0-.01|M3.5 19a5.5 5.5 0 0 1 11 0|M16 6a3 3 0 0 1 0 6|M21 19a5.5 5.5 0 0 0-4-5.3" />, name: "Crew & Rollen", role: "Assistenz, Styling, Retusche, Agentur — geclaimt, nicht hinterhergerannt." },
  { icon: <I d="M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5" />, name: "Arbeitspakete", role: "Das Set, die Edit, die Lieferung — in übernehmbare Teile geteilt." },
  { icon: <I d="M9 6h11|M9 12h11|M9 18h11|M4 5.5l1 1 2-2|M4 11.5l1 1 2-2|M4 17.5l1 1 2-2" />, name: "Shotlist", role: "Jeder Winkel und jedes Setup, am Set abgehakt." },
  { icon: <I d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M3 9h18|M8 2v4|M16 2v4" />, name: "Termine", role: "Shooting-Tag, Review-Call, Liefertermin — im Kontext." },
  { icon: <I d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z|M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />, name: "Location", role: "Studio oder Set, für alle auf der Karte gepinnt." },
  { icon: <I d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 17l-5-5L5 21" />, name: "Moodboard", role: "Referenz und Inspiration in einem Rahmen." },
  { icon: <I d="M21 12.5L12.5 21a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.6 1.6 0 0 1-2.3-2.3l8-8" />, name: "Dateien", role: "Briefings, Verträge, Specs — angehängt, wo sie hingehören." },
  { icon: <I d="M12 20h9|M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />, name: "Notizen", role: "Alles, was in keine Box passt." },
  { icon: <I d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M9.3 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1 .8-1 1.6" />, name: "Fragen & Antworten", role: "Offene Fragen, die Kunde oder Team beantworten." },
  { icon: <I d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z|M8.5 12h7" />, name: "Diskussion", role: "Das laufende Gespräch, direkt neben der Arbeit." },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/55">{children}</p>;
}

export default function ProductPhotographyPage() {
  return (
    <div className="relative">
      <EmergentBackdrop />

      <div className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <Container className="pt-32 sm:pt-40 pb-12 sm:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Eyebrow>Für Produkt- &amp; Commercial-Fotografen</Eyebrow>
              <h1 className="mt-5 font-heading text-[40px] italic leading-[1.0] tracking-[-0.01em] text-white sm:text-[64px]">
                Das Foto ist der einfache Teil.
              </h1>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-white/70 sm:text-[20px]">
                Das Briefing, die Rechte, die Shotlist, die Freigaben, die Übergabe —
                dort entsteht oder verschwindet die Marge. MAGYC macht aus der ersten
                Kundenmail ein gemeinsames Projekt und aus dem fertigen Shooting eine
                Präsentation. Einmal eingeben; nie wieder denselben Auftrag abtippen.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/#start"
                  className="liquid-glass-strong rounded px-5 py-2.5 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                >
                  Projekt starten
                </Link>
                <Link href="/showcase" className="mono text-[12px] uppercase tracking-widest text-white/55 hover:text-white">
                  Beispielprojekt ansehen →
                </Link>
              </div>
            </div>
            <SiteImage
              src="/media/hero-bts.jpg"
              alt="Produktshooting im dunklen Studio: getetherte Kamera, Laptop, Produkt auf dem Sweep"
              ratio="4 / 5"
              caption="Set · Produktshooting"
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority
            />
          </div>
        </Container>

        {/* ── Das Problem ──────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>Der eigentliche Job</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              Ein Commercial-Shooting ist ein Koordinationsproblem mit Kamera.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["2–6 Tools", "pro Projekt — CRM, Galerie, Mail, Tabelle, Vertrag — und in jedes tippst du dieselben Daten neu."],
                ["Die unsichtbaren Stunden", "Briefing, Nutzungsrechte, Freigaben, Delivery-Konfiguration: Hier versickert die Marge leise."],
                ["Jedes Mal neu gebaut", "Die Übergabe und die Case Study werden jedes Mal von Hand zusammengestellt."],
              ].map(([big, small]) => (
                <div key={big} className="bg-black/40 p-6">
                  <div className="font-heading text-[24px] italic text-white sm:text-[28px]">{big}</div>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/60">{small}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── Sample work ──────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>Gemacht für Arbeit wie diese</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[40px]">
              Vom Stillleben über Beauty bis Tech.
            </h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/65">
              MAGYC trägt das Projekt — du machst die Bilder.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
              {WORK.map((w) => (
                <SiteImage
                  key={w.src}
                  src={w.src}
                  alt={w.alt}
                  ratio="1 / 1"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                />
              ))}
            </div>
            <p className="mono mt-5 text-[11px] uppercase tracking-[0.2em] text-white/35">
              Beispielhafte Produktfotografie · keine Stockbilder
            </p>
          </div>
        </Container>

        {/* ── So läuft es — der Lebenszyklus ───────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>Ein Projekt, drei Phasen</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              Dasselbe Projekt — vom Briefing bis zur Übergabe getragen.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {LIFECYCLE.map((s) => (
                <div key={s.n} className="liquid-glass rounded-2xl p-6">
                  <div className="mono text-[12px] tracking-widest text-white/40">{s.n}</div>
                  <h3 className="mt-3 font-heading text-[26px] italic text-white">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/68">{s.lead}</p>
                  <p className="mt-4 text-[13px] leading-relaxed text-white/45">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── Bausteine ────────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>Die Bausteine</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              Kein Template. Ein Baukasten aus kleinen, scharfen Teilen.
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/68">
              MAGYC setzt jedes Projekt aus fokussierten Bausteinen zusammen und wählt
              die, die dein Shooting wirklich braucht — statt es in eine starre Form zu pressen.
            </p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {BLOCKS.map((b) => (
                <div key={b.name} className="bg-black/40 p-6 transition-colors duration-200 hover:bg-black/20">
                  <div className="text-white/85">{b.icon}</div>
                  <h3 className="mt-4 font-body text-[16px] font-medium text-white">{b.name}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{b.role}</p>
                </div>
              ))}
            </div>
            <p className="mono mt-6 text-[11px] uppercase tracking-[0.2em] text-white/35">
              …und mehr — MAGYC wählt, konfiguriert und ordnet sie für jeden Auftrag.
            </p>
          </div>
        </Container>

        {/* ── Present (Modul 3) ────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Eyebrow>Wenn das Shooting steht</Eyebrow>
                <h2 className="mt-4 font-heading text-[30px] italic leading-[1.08] text-white sm:text-[46px]">
                  Dasselbe Projekt, neu geboren als Präsentation.
                </h2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">
                  Die Location, die Crew, die Deliverables, die finalen Selects — schon
                  im System. Ein Klick setzt daraus eine gebrandete Recap- und Übergabe-Seite
                  zusammen. Farben und ein paar Worte anpassen; im Grunde fertig.
                </p>
                <div className="mt-8 flex items-center gap-3 text-[13px] text-white/50">
                  <span className="mono rounded border border-white/15 px-2.5 py-1 tracking-widest">PLANEN</span>
                  <span aria-hidden className="text-white/30">→</span>
                  <span className="mono rounded border border-white/15 px-2.5 py-1 tracking-widest text-white/80">PRÄSENTIEREN</span>
                </div>
              </div>
              <MediaPlaceholder label="Auto-generierte Präsentationsseite" ratio="4 / 3" caption="Annotiertes Beispiel · folgt" />
            </div>
          </div>
        </Container>

        {/* ── Positionierung: Die KI macht den Bürokram ────────── */}
        <Container className="py-16 sm:py-24">
          <div className="liquid-glass rounded-2xl border-t border-white/10 p-8 sm:p-12">
            <Eyebrow>Wo die KI hilft</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-[28px] italic leading-[1.1] text-white sm:text-[40px]">
              Die KI macht den Bürokram. Du behältst das Handwerk.
            </h2>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-white/70">
              MAGYC fasst deine Bilder und deinen Stil nicht an. Sie übernimmt die
              Struktur, die Admin und die Übergabe — die unsichtbaren Stunden zwischen
              den Shootings. Das Shooting gehört dir, und das letzte Wort auch.
            </p>
          </div>
        </Container>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <Container className="pb-28 pt-8 text-center sm:pb-36">
          <h2 className="mx-auto max-w-2xl font-heading text-[32px] italic leading-[1.05] text-white sm:text-[52px]">
            Starte dein nächstes Shooting in MAGYC.
          </h2>
          <div className="mt-9 flex items-center justify-center">
            <Link
              href="/#start"
              className="liquid-glass-strong rounded px-6 py-3 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              Kostenlos testen
            </Link>
          </div>
        </Container>
      </div>
    </div>
  );
}
