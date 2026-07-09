import type { Metadata } from "next";
import Image from "next/image";
import { Section, Eyebrow } from "@/components/site/sections";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale, getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).sitePages.story;
  return { title: t.title, description: t.description };
}

export default async function StoryPage() {
  const { t } = await getServerI18n();
  const copy = t.sitePages.story;
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">{copy.headline}</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">{copy.lead}</p>
      </Section>
      <section className="relative min-h-[420px] overflow-hidden bg-black sm:min-h-[560px]">
        <Image src="/media/hero-bts.jpg" alt={copy.heroAlt} fill sizes="100vw" className="object-cover" />
      </section>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <Eyebrow>{copy.thought}</Eyebrow>
          <div className="max-w-3xl space-y-7 text-[18px] leading-[1.75] text-black/65">
            <p>{copy.p1}</p>
            <p>{copy.p2}</p>
            <p className="font-brand text-[28px] font-bold leading-tight text-[#17171a] sm:text-[36px]">{copy.quote}</p>
          </div>
        </div>
      </Section>
    </>
  );
}
