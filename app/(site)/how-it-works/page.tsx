import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "So funktioniert's — MAGYC",
  description: "Vom ersten Satz bis zum abgeschlossenen Fotografie-Auftrag.",
};

const STEPS = [
  ["01", "Auftrag beschreiben", "Ein Satz genügt als Anfang. Presets, Schnellbausteine und nur die wirklich nötigen Rückfragen ergänzen den Kontext.", "/media/marketing/behind-the-scenes.png"],
  ["02", "Projektseite entsteht", "MAGYC wählt passende Elemente und bereitet Bildidee, Motive, Orte, Beteiligte und Aufgaben als gemeinsamen Arbeitsraum vor.", "/media/marketing/projektseite-preview.png"],
  ["03", "Gemeinsam schärfen", "Kund:innen und Team ergänzen Medien, treffen Entscheidungen und geben dort frei, wo die Information bereits liegt.", "/media/marketing/fotograf-abstimmung.png"],
  ["04", "Verbindlich abschließen", "Aus der abgestimmten Planung entsteht der Vertragsentwurf. Nach Prüfung und Signatur bleibt das Projekt sauber aufbereitet.", "/media/marketing/finale-uebergabe.png"],
];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>So funktioniert&apos;s</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">Von der losen Anfrage zum klaren Fotografie-Auftrag.</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">MAGYC verbindet Planung, Zusammenarbeit und Vertrag in einem durchgehenden Prozess, ohne den kreativen Teil zu standardisieren.</p>
      </Section>
      <Section className="pt-0">
        <div className="space-y-16 sm:space-y-24">
          {STEPS.map(([number, title, copy, image], index) => (
            <article key={number} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={index % 2 ? "lg:order-2" : ""}>
                <span className="mono text-[10px] tracking-widest text-black/35">{number}</span>
                <h2 className="mt-4 font-brand text-[30px] font-bold leading-tight text-[#17171a] sm:text-[42px]">{title}</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-black/56">{copy}</p>
              </div>
              <div className={`relative aspect-[16/10] overflow-hidden bg-black ${index % 2 ? "lg:order-1" : ""}`}>
                <Image src={image} alt={`${title} in MAGYC`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section className="pt-0">
        <div className="grid bg-[#17171a] p-7 text-white sm:p-11 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Eyebrow><span className="text-white/50">Dein nächster Auftrag</span></Eyebrow>
            <h2 className="mt-4 max-w-2xl font-brand text-[30px] font-bold leading-tight sm:text-[46px]">Beginne mit dem, was du bereits weißt.</h2>
          </div>
          <Link href="/#start" className="mt-7 w-fit rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[#17171a] lg:mt-0">Auftrag planen</Link>
        </div>
      </Section>
    </>
  );
}
