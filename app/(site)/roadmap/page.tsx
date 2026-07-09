import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/site/sections";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale, getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).sitePages.roadmap;
  return { title: t.title, description: t.description };
}

export default async function RoadmapPage() {
  const { t } = await getServerI18n();
  const copy = t.sitePages.roadmap;
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">{copy.headline}</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-black/58">{copy.lead}</p>
      </Section>
      <Section className="pt-0">
        <div className="grid border-y border-black/10 sm:grid-cols-3">
          {copy.tracks.map(([time, title, trackCopy], index) => (
            <article key={time} className="py-7 sm:border-l sm:border-black/10 sm:px-7 sm:first:border-l-0">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-black/38">{time}</span>
              <h2 className="mt-4 text-[20px] font-semibold text-[#17171a]">{title}</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-black/55">{trackCopy}</p>
              <span className="mono mt-8 block text-[10px] tracking-widest text-black/25">0{index + 1}</span>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
