import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale, getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).sitePages.docs;
  return { title: t.title, description: t.description };
}

export default async function DocsPage() {
  const { t } = await getServerI18n();
  const copy = t.sitePages.docs;
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">{copy.headline}</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">{copy.lead}</p>
      </Section>
      <Section className="pt-0">
        <div className="divide-y divide-black/10 border-y border-black/10">
          {copy.guides.map(([number, title, guideCopy]) => (
            <article key={number} className="grid gap-3 py-7 sm:grid-cols-[80px_240px_1fr] sm:items-start">
              <span className="mono text-[10px] tracking-widest text-black/35">{number}</span>
              <h2 className="text-[19px] font-semibold text-[#17171a]">{title}</h2>
              <p className="max-w-2xl text-[14px] leading-relaxed text-black/55">{guideCopy}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/#start" className="rounded-full bg-[#17171a] px-5 py-3 text-[14px] font-medium text-white">{copy.try}</Link>
          <Link href="/contact" className="rounded-full border border-black/15 px-5 py-3 text-[14px] font-medium text-black/70">{copy.ask}</Link>
        </div>
      </Section>
    </>
  );
}
