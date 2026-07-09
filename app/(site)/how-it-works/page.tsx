import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale, getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).sitePages.how;
  return { title: t.title, description: t.description };
}

export default async function HowItWorksPage() {
  const { t } = await getServerI18n();
  const copy = t.sitePages.how;
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">{copy.headline}</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">{copy.lead}</p>
      </Section>
      <Section className="pt-0">
        <div className="space-y-16 sm:space-y-24">
          {copy.steps.map(([number, title, stepCopy, image], index) => (
            <article key={number} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={index % 2 ? "lg:order-2" : ""}>
                <span className="mono text-[10px] tracking-widest text-black/35">{number}</span>
                <h2 className="mt-4 font-brand text-[30px] font-bold leading-tight text-[#17171a] sm:text-[42px]">{title}</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-black/56">{stepCopy}</p>
              </div>
              <div className={`relative aspect-[16/10] overflow-hidden bg-black ${index % 2 ? "lg:order-1" : ""}`}>
                <Image src={image} alt={copy.imageAlt.replace("{title}", title)} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section className="pt-0">
        <div className="grid bg-[#17171a] p-7 text-white sm:p-11 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Eyebrow><span className="text-white/50">{copy.ctaEyebrow}</span></Eyebrow>
            <h2 className="mt-4 max-w-2xl font-brand text-[30px] font-bold leading-tight sm:text-[46px]">{copy.ctaTitle}</h2>
          </div>
          <Link href="/#start" className="mt-7 w-fit rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[#17171a] lg:mt-0">{copy.cta}</Link>
        </div>
      </Section>
    </>
  );
}
