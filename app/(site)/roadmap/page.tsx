import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "Roadmap — MAGYC",
  description: "Woran MAGYC aktuell arbeitet und welche Richtung das Produkt nimmt.",
};

const TRACKS = [
  ["Jetzt", "Zuverlässiger Kern", "Projekte, Elemente, Presets, Zusammenarbeit und Vertrag werden mit echten Fotografie-Aufträgen stabilisiert."],
  ["Als Nächstes", "Weniger Handarbeit", "Wiederkehrende Übergaben, Benachrichtigungen und Integrationen sollen sich stärker aus dem Projektkontext ableiten."],
  ["Später", "Verbundener Workflow", "Weitere professionelle Werkzeuge werden dort angebunden, wo MAGYC bestehende Spezialsoftware sinnvoll ergänzt."],
];

export default function RoadmapPage() {
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>Roadmap</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">Ein stabiler Kern vor immer mehr Funktionen.</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">Die Richtung ist bewusst pragmatisch: erst einen vollständigen Fotografie-Auftrag hervorragend tragen, dann das System erweitern.</p>
      </Section>
      <Section className="pt-0">
        <div className="grid border-y border-black/10 sm:grid-cols-3">
          {TRACKS.map(([time, title, copy], index) => (
            <article key={time} className="py-7 sm:border-l sm:border-black/10 sm:px-7 sm:first:border-l-0">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-black/38">{time}</span>
              <h2 className="mt-4 text-[20px] font-semibold text-[#17171a]">{title}</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-black/55">{copy}</p>
              <span className="mono mt-8 block text-[10px] tracking-widest text-black/25">0{index + 1}</span>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
