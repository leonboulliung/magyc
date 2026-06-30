import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "Changelog — MAGYC",
  description: "Die wichtigsten Produktänderungen in MAGYC.",
};

const ENTRIES = [
  ["Aktuell", "Fotografie-fokussierter Projektstart", "Kontosprache, Presets und Rückfragen greifen jetzt durchgängig ineinander; fachfremde Anfragen werden nicht als Projekt ausgegeben."],
  ["Aktuell", "Planung, Vertrag, Abgeschlossen", "Der Projektlebenszyklus ist auf drei verständliche Schritte reduziert und der Vertragsentwurf entsteht beim Wechsel automatisch."],
  ["Aktuell", "Stabilere Elemente", "Medien, Einträge und gemeinsame Bearbeitung folgen einheitlicheren Regeln für Uploads, Speicherung und Bedienung."],
];

export default function ChangelogPage() {
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>Changelog</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">Was sich in MAGYC verbessert.</h1>
      </Section>
      <Section className="pt-0">
        <div className="max-w-4xl divide-y divide-black/10 border-y border-black/10">
          {ENTRIES.map(([date, title, copy], index) => (
            <article key={`${title}-${index}`} className="grid gap-3 py-7 sm:grid-cols-[120px_1fr]">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-black/38">{date}</span>
              <div>
                <h2 className="text-[19px] font-semibold text-[#17171a]">{title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-black/55">{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
