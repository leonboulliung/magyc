import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "Doku — MAGYC",
  description: "Der schnelle Einstieg in Projekte, Presets und Zusammenarbeit mit MAGYC.",
};

const GUIDES = [
  ["01", "Einen Auftrag starten", "Beschreibe das Shooting, beantworte nur die relevanten Rückfragen und prüfe den erzeugten Arbeitsraum."],
  ["02", "Eigene Presets", "Lege wiederkehrende Elemente, Inhalte und Regeln einmal fest und verwende sie bei künftigen Aufträgen erneut."],
  ["03", "Kund:innen einladen", "Teile Projekte gezielt, vergebe eine Rolle und halte Auswahl, Medien und Freigaben direkt am Auftrag."],
  ["04", "Vertrag vorbereiten", "Wechsle nach der Planung in Vertrag, prüfe den Entwurf und lege vor der Freigabe die Signaturart fest."],
];

export default function DocsPage() {
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>Doku</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">Schnell verstehen. Direkt am echten Auftrag lernen.</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">MAGYC ist bewusst klein im Einstieg: Auftrag beschreiben, Struktur prüfen, gemeinsam weiterarbeiten.</p>
      </Section>
      <Section className="pt-0">
        <div className="divide-y divide-black/10 border-y border-black/10">
          {GUIDES.map(([number, title, copy]) => (
            <article key={number} className="grid gap-3 py-7 sm:grid-cols-[80px_240px_1fr] sm:items-start">
              <span className="mono text-[10px] tracking-widest text-black/35">{number}</span>
              <h2 className="text-[19px] font-semibold text-[#17171a]">{title}</h2>
              <p className="max-w-2xl text-[14px] leading-relaxed text-black/55">{copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/#start" className="rounded-full bg-[#17171a] px-5 py-3 text-[14px] font-medium text-white">Auftrag ausprobieren</Link>
          <Link href="/contact" className="rounded-full border border-black/15 px-5 py-3 text-[14px] font-medium text-black/70">Frage stellen</Link>
        </div>
      </Section>
    </>
  );
}
