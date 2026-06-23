import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Preise — MAGYC",
  description:
    "Vom kostenlosen Start bis zum Studio-Plan. MAGYC trägt dein Fotoprojekt vom Briefing bis zur Übergabe.",
};

/* Marketing-Pricing — noch kein Billing/Checkout. CTAs führen vorerst auf
   den freien Start (/#start). Tier-Modell ist ein Vorschlag (Wettbewerbs-
   band 12–48 €/Mon), siehe docs/STRATEGY.md — Preise/Inhalte sind anpassbar. */
const TIERS: {
  name: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
}[] = [
  {
    name: "Free",
    price: "0 €",
    tagline: "Zum Ausprobieren und für das erste Projekt.",
    features: [
      "1 aktives Projekt",
      "Alle Kern-Bausteine",
      "Geteilte Projektseite",
      "Übergabe-Seite mit MAGYC-Branding",
    ],
    cta: "Kostenlos starten",
  },
  {
    name: "Pro",
    price: "19 €",
    period: "/ Monat",
    tagline: "Für Fotograf:innen, die laufend mit Kunden arbeiten.",
    features: [
      "Unbegrenzte Projekte",
      "Übergabe-Seiten ohne MAGYC-Branding",
      "Eigene Farben & Marke",
      "Mail-Intake (Kundenmail → Projekt)",
      "Eigene Domain für Übergaben",
    ],
    cta: "Pro starten",
    featured: true,
  },
  {
    name: "Studio",
    price: "39 €",
    period: "/ Monat",
    tagline: "Für Teams, mehrere Standorte und Corporate-Aufträge.",
    features: [
      "Alles aus Pro",
      "Team — mehrere Fotograf:innen",
      "Mehr-Standorte & Corporate-Workflows",
      "Mehr Speicher",
      "Priorisierter Support",
    ],
    cta: "Studio starten",
  },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-black/55">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <Container className="pt-28 sm:pt-36 pb-28">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Preise</p>
      <h1 className="mt-5 max-w-2xl font-brand text-[38px] font-bold leading-[1.03] tracking-[-0.02em] text-[#17171a] sm:text-[60px]">
        Bezahl für die Arbeit, die MAGYC dir abnimmt.
      </h1>
      <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-black/58">
        Starte kostenlos. Wenn MAGYC dir laufend Stunden zwischen den Shootings spart,
        wächst es mit dir mit.
      </p>

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className="flex flex-col rounded-2xl border p-7"
            style={{
              borderColor: t.featured ? "rgba(0,0,0,0.22)" : brand.rule,
              background: brand.surface,
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-brand text-[20px] font-bold tracking-[-0.01em] text-[#17171a]">{t.name}</h2>
              {t.featured && (
                <span className="mono rounded-full border border-black/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-black/60">
                  Beliebt
                </span>
              )}
            </div>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-brand text-[40px] font-bold tracking-[-0.02em] text-[#17171a]">{t.price}</span>
              {t.period && <span className="text-[14px] text-black/45">{t.period}</span>}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-black/55">{t.tagline}</p>

            <ul className="mt-6 flex flex-1 flex-col gap-3">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-[14px] leading-snug text-black/70">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/#start"
              className="mt-7 rounded-full px-5 py-2.5 text-center font-body text-sm font-medium transition-all duration-200 active:scale-[0.98]"
              style={
                t.featured
                  ? { background: "#17171a", color: "#fff" }
                  : { border: `1px solid ${brand.rule}`, color: "#17171a" }
              }
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mono mt-8 text-[11px] uppercase tracking-[0.2em] text-black/35">
        Preise vorläufig · während der Beta startet jeder Plan kostenlos
      </p>
    </Container>
  );
}
