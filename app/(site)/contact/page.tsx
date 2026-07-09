import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale, getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).sitePages.contact;
  return { title: t.title, description: t.description };
}

export default async function ContactPage() {
  const { t } = await getServerI18n();
  const copy = t.sitePages.contact;
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h1 className="mt-4 max-w-3xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">{copy.headline}</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-black/58">{copy.lead}</p>
          </div>
          <Link href="mailto:leon@magyc.site" className="group flex items-center justify-between border-y border-black/12 py-5 text-[18px] font-medium text-[#17171a]">
            leon@magyc.site
            <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
          </Link>
        </div>
      </Section>
      <Section className="pt-0">
        <div className="grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-3">
          {copy.cards.map(([title, cardCopy]) => (
            <div key={title} className="bg-white p-6 sm:p-8">
              <h2 className="text-[18px] font-semibold text-[#17171a]">{title}</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-black/52">{cardCopy}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
