import type { Metadata } from "next";
import Image from "next/image";
import { Section, Eyebrow } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "Geschichte — MAGYC",
  description: "Warum MAGYC die Arbeit rund um Fotografie-Aufträge neu ordnet.",
};

export default function StoryPage() {
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>Warum MAGYC</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">Kreative Arbeit braucht Raum. Ihre Organisation braucht Klarheit.</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">Fotografie-Projekte scheitern selten an der Kamera. Reibung entsteht in verstreuten Nachrichten, unklaren Erwartungen, fehlenden Freigaben und wiederkehrender Verwaltungsarbeit.</p>
      </Section>
      <section className="relative min-h-[420px] overflow-hidden bg-black sm:min-h-[560px]">
        <Image src="/media/hero-bts.jpg" alt="Fotografie-Produktion hinter den Kulissen" fill sizes="100vw" className="object-cover" />
      </section>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <Eyebrow>Der Gedanke</Eyebrow>
          <div className="max-w-3xl space-y-7 text-[18px] leading-[1.75] text-black/65">
            <p>MAGYC beginnt nicht mit einer leeren Projektvorlage. Eine grobe Anfrage reicht. Daraus entsteht ein Arbeitsraum, der Bildidee, Beteiligte, Planung und Vertrag zusammenführt.</p>
            <p>Die Software soll Kreativität nicht standardisieren. Sie übernimmt die wiederkehrende Struktur, damit Fotograf:innen ihre Aufmerksamkeit dort einsetzen können, wo Urteil, Erfahrung und eine eigene Handschrift zählen.</p>
            <p className="font-brand text-[28px] font-bold leading-tight text-[#17171a] sm:text-[36px]">Weniger Koordination. Mehr gemeinsames Verständnis. Bessere kreative Ergebnisse.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
