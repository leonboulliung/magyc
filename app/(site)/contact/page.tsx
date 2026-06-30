import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "Kontakt — MAGYC",
  description: "Fragen, Rückmeldungen oder Hilfe zu MAGYC.",
};

export default function ContactPage() {
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <Eyebrow>Kontakt</Eyebrow>
            <h1 className="mt-4 max-w-3xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">Lass uns über deine Arbeit sprechen.</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-black/58">Du hast eine Frage, möchtest einen Fehler melden oder MAGYC in deinem Workflow testen? Schreib direkt an Leon.</p>
          </div>
          <Link href="mailto:leon@magyc.site" className="group flex items-center justify-between border-y border-black/12 py-5 text-[18px] font-medium text-[#17171a]">
            leon@magyc.site
            <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
          </Link>
        </div>
      </Section>
      <Section className="pt-0">
        <div className="grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-3">
          {[
            ["Produktfeedback", "Was hilft dir bereits, was bremst dich noch? Konkrete Rückmeldungen fließen direkt in die nächsten Iterationen."],
            ["Technische Hilfe", "Beschreibe kurz, wo du warst und was du erwartet hast. Screenshots helfen bei der schnellen Einordnung."],
            ["Früher Zugang", "Du möchtest MAGYC mit echten Aufträgen erproben? Erzähl kurz, welche Art von Fotografie du machst."],
          ].map(([title, copy]) => (
            <div key={title} className="bg-white p-6 sm:p-8">
              <h2 className="text-[18px] font-semibold text-[#17171a]">{title}</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-black/52">{copy}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
