"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { MediaFrame } from "@/components/site/MediaFrame";
import { SiteFooter } from "@/components/site/SiteFooter";
import { USE_CASES } from "@/lib/site";
import type { MediaKey } from "@/lib/siteMedia";

/**
 * HomeMarketing — the scrollable marketing story rendered below the hero tool
 * on the landing page. Concrete photography language, warm gradients, real
 * media slots (swap via lib/siteMedia) and subtle motion. Self-contained so the
 * homepage create flow stays untouched; ends with the site footer.
 */

const WARM = "linear-gradient(135deg, #ffb347, #ff7ea8, #9b8cff)";
const INK = "#17171a";
const MUTED = "rgba(23,23,26,0.58)";

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className ?? ""}`}>{children}</section>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-[11px] uppercase tracking-[0.24em]" style={{ color: "rgba(23,23,26,0.5)" }}>{children}</p>;
}

/* ── Section data ──────────────────────────────────────────────────────── */

const PROBLEMS = [
  { icon: "💬", title: "Abstimmungschaos", body: "WhatsApp, Mail, Sprachnotizen — Entscheidungen liegen verstreut und gehen unter." },
  { icon: "🧩", title: "Verstreute Details", body: "Location, Termine, Must-haves, Nutzungsrechte: überall ein bisschen, nirgends komplett." },
  { icon: "🎯", title: "Unklare Erwartungen", body: "Vor dem Shoot weiß keiner sicher, was am Ende geliefert wird — Stress am Set." },
];

const ELEMENTS = [
  { k: "Moodboard", c: "#9b8cff" },
  { k: "Shotlist", c: "#5b9dff" },
  { k: "Locations", c: "#39d2b4" },
  { k: "Aufgaben", c: "#57c98a" },
  { k: "Termine", c: "#f5b740" },
  { k: "Freigaben", c: "#f4719b" },
  { k: "Vertrag", c: "#ff8a5b" },
];

const STEPS = [
  { n: "1", title: "Kundenanfrage kommt rein", body: "Eine vage Nachricht genügt — ein Satz reicht.", media: "behindScenes" as const },
  { n: "2", title: "MAGYC baut die Projektseite", body: "Aus der Idee wird eine klare Seite aus passenden Elementen.", media: "projectPageStill" as const },
  { n: "3", title: "Kunde & Team stimmen ab", body: "Ein Link: kommentieren, wählen, freigeben — gemeinsam.", media: "alignment" as const },
  { n: "4", title: "Klarer Auftrag & Übergabe", body: "Vertrag unterschrieben, Bilder übergeben — sauber abgeschlossen.", media: "handoff" as const },
];

const USE_CASE_MEDIA: Record<string, MediaKey> = {
  "/product": "productTile",
  "/event": "eventTile",
  "/wedding": "weddingTile",
  "/corporate": "corporateTile",
  "/fashion": "fashionTile",
};

/* ── Composition ───────────────────────────────────────────────────────── */

export function HomeMarketing() {
  return (
    <div className="relative w-full pt-14 sm:pt-20">
      {/* Hero footage band — the first big, warm visual under the fold */}
      <Section>
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.08]">
            <MediaFrame media="heroFootage" ratio="21 / 9" priority sizes="100vw" />
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(23,23,26,0.42), transparent 55%)" }} />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 p-4 sm:p-6">
              {["Briefing", "Moodboard", "Shotlist", "Locations", "Freigaben", "Vertrag"].map((c) => (
                <span key={c} className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium backdrop-blur-sm" style={{ color: INK }}>{c}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Problem */}
      <Section className="pt-20 pb-4">
        <Reveal>
          <Eyebrow>Das Problem</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-[26px] font-semibold leading-[1.1] tracking-tight sm:text-[38px]" style={{ color: INK }}>
            Kreative Projekte scheitern selten am Können — sondern an der Abstimmung davor.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-black/[0.08] bg-white p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
                <div className="text-[22px]">{p.icon}</div>
                <h3 className="mt-3 text-[17px] font-semibold" style={{ color: INK }}>{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: MUTED }}>{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Before / After */}
      <Section className="pt-20">
        <Reveal>
          <Eyebrow>Vorher / Nachher</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-[26px] font-semibold leading-[1.1] tracking-tight sm:text-[38px]" style={{ color: INK }}>
            Aus einer losen Anfrage wird eine klare Projektseite.
          </h2>
        </Reveal>
        <div className="mt-8 grid items-center gap-5 lg:grid-cols-[1fr_auto_1.2fr]">
          <Reveal>
            <div className="rounded-2xl border border-black/[0.08] bg-[#faf6f1] p-5">
              <div className="mono mb-3 text-[10px] uppercase tracking-widest" style={{ color: "rgba(23,23,26,0.4)" }}>Kundenanfrage</div>
              <div className="space-y-3">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-[14px] leading-relaxed shadow-sm" style={{ color: INK }}>
                  „Hey, wir bräuchten mal so Produktfotos für unsere neue Kaffeemarke. Modern, aber warm. Vielleicht draußen? Sag, was du brauchst 🙂"
                </div>
                <div className="ml-auto max-w-[70%] rounded-2xl rounded-br-sm px-4 py-3 text-[13px] text-white" style={{ background: INK }}>
                  Wann, wo, wie viele Bilder, wofür? …
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="hidden lg:block">
            <div className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg" style={{ background: WARM }}>→</div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <MediaFrame media="projectPage" ratio="16 / 11" sizes="(max-width:1024px) 100vw, 55vw" />
              <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-1.5">
                {["Moodboard", "Shotlist", "Locations", "Freigaben"].map((c) => (
                  <span key={c} className="rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium shadow-sm" style={{ color: INK }}>{c}</span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Demo scene: input → generated plan */}
      <Section className="pt-20">
        <div className="overflow-hidden rounded-[28px] border border-black/[0.08] p-7 sm:p-12" style={{ background: "linear-gradient(160deg, #fff7ef, #f4f1ff)" }}>
          <Reveal>
            <Eyebrow>Live, in Sekunden</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-[24px] font-semibold leading-[1.12] tracking-tight sm:text-[34px]" style={{ color: INK }}>
              Du beschreibst die Idee. MAGYC legt den Projektplan an.
            </h2>
          </Reveal>
          <div className="mt-8 flex flex-col items-stretch gap-6 lg:flex-row lg:items-center">
            <Reveal className="lg:w-[42%]">
              <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
                <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(23,23,26,0.4)" }}>Deine Eingabe</div>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: INK }}>
                  „Produktshooting für eine handgemachte Keramik-Serie, clean und warm, draußen in Köln."
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1} className="hidden lg:block">
              <div className="grid h-10 w-10 place-items-center rounded-full text-white shadow" style={{ background: WARM }}>→</div>
            </Reveal>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              {ELEMENTS.map((e, i) => (
                <Reveal key={e.k} delay={0.15 + i * 0.06}>
                  <div className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-[13px] font-medium shadow-sm" style={{ color: INK }}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.c }} />
                    {e.k}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Feature bento */}
      <Section className="pt-20">
        <Reveal>
          <Eyebrow>Alles an einem Ort</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-[26px] font-semibold leading-[1.1] tracking-tight sm:text-[38px]" style={{ color: INK }}>
            Briefing, Moodboard, Shotlist, Locations, Termine, Freigaben — und der Vertrag.
          </h2>
        </Reveal>
        <div className="mt-8 grid auto-rows-[minmax(150px,auto)] grid-cols-2 gap-4 lg:grid-cols-4">
          <Reveal className="col-span-2 row-span-2">
            <BentoCard title="Moodboard" body="Visuelle Richtung, Referenzen und No-gos — gemeinsam abgestimmt." className="h-full">
              <MediaFrame media="moodboard" ratio="16 / 10" sizes="(max-width:1024px) 100vw, 50vw" />
            </BentoCard>
          </Reveal>
          <Reveal delay={0.05}><BentoTextCard title="Shotlist" body="Jede Aufnahme geplant — Priorität, Setup, Ort." accent="#5b9dff" /></Reveal>
          <Reveal delay={0.1}><BentoTextCard title="Locations" body="Orte auf der Karte, statt im Chat-Verlauf." accent="#39d2b4" /></Reveal>
          <Reveal delay={0.15}><BentoTextCard title="Termine & Aufgaben" body="Wer macht was bis wann — sichtbar für alle." accent="#f5b740" /></Reveal>
          <Reveal delay={0.2}><BentoTextCard title="Freigaben" body="Kund:innen geben Looks und Auswahl klar frei." accent="#f4719b" /></Reveal>
          <Reveal className="col-span-2" delay={0.1}>
            <BentoCard title="Vertrag" body="Aus dem Plan entsteht der verbindliche Vertrag — beide unterschreiben digital." className="h-full" gradient="linear-gradient(135deg,#fff3e6,#ffe9ef)" />
          </Reveal>
        </div>
      </Section>

      {/* Use cases */}
      <Section className="pt-20">
        <Reveal>
          <Eyebrow>Für deine Arbeit</Eyebrow>
          <h2 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-tight sm:text-[38px]" style={{ color: INK }}>
            Ein Arbeitsraum für jedes Shooting.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {USE_CASES.map((u, i) => (
            <Reveal key={u.href} delay={i * 0.06}>
              <Link href={u.href} className="group block overflow-hidden rounded-2xl border border-black/[0.08] bg-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
                <MediaFrame media={USE_CASE_MEDIA[u.href] ?? "shootingSetup"} ratio="4 / 5" sizes="(max-width:1024px) 50vw, 20vw" />
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <span className="text-[15px] font-semibold" style={{ color: INK }}>{u.label}</span>
                  <span aria-hidden className="text-black/35 transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Steps */}
      <Section className="pt-20">
        <Reveal>
          <Eyebrow>So funktioniert's</Eyebrow>
          <h2 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-tight sm:text-[38px]" style={{ color: INK }}>
            Von der ersten Anfrage bis zur Freigabe.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="group h-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white transition-transform duration-300 hover:-translate-y-1">
                <MediaFrame media={s.media} ratio="4 / 3" sizes="(max-width:1024px) 100vw, 25vw" />
                <div className="p-5">
                  <div className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold text-white" style={{ background: INK }}>{s.n}</div>
                  <h3 className="mt-3 text-[16px] font-semibold leading-snug" style={{ color: INK }}>{s.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: MUTED }}>{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="pt-20 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-12 sm:py-24" style={{ background: INK }}>
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(255,140,90,0.35), transparent 70%), radial-gradient(50% 70% at 80% 100%, rgba(155,140,255,0.35), transparent 70%)" }} />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[46px]">
                Erstelle dein erstes Projekt — kostenlos.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
                Beschreibe eine Idee, MAGYC baut die Projektseite. In Sekunden, ohne Setup.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/#start" className="rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[#17171a] transition-transform hover:scale-[1.03]">
                  Kostenlos ausprobieren
                </Link>
                <Link href="/showcase" className="rounded-full border border-white/25 px-6 py-3 text-[14px] font-medium text-white/85 transition-colors hover:border-white/50 hover:text-white">
                  Beispielprojekt ansehen
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      <SiteFooter />
    </div>
  );
}

function BentoCard({ title, body, children, className, gradient }: { title: string; body: string; children?: ReactNode; className?: string; gradient?: string }) {
  return (
    <div className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${className ?? ""}`} style={{ background: gradient ?? "#fff" }}>
      {children}
      <div className="p-5">
        <h3 className="text-[17px] font-semibold" style={{ color: INK }}>{title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: MUTED }}>{body}</p>
      </div>
    </div>
  );
}

function BentoTextCard({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <h3 className="mt-1 text-[16px] font-semibold" style={{ color: INK }}>{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: MUTED }}>{body}</p>
    </div>
  );
}
