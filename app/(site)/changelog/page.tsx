import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/site/sections";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale, getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).sitePages.changelog;
  return { title: t.title, description: t.description };
}

export default async function ChangelogPage() {
  const { t } = await getServerI18n();
  const copy = t.sitePages.changelog;
  return (
    <>
      <Section className="pt-16 sm:pt-24">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.03] text-[#17171a] sm:text-[64px]">{copy.headline}</h1>
      </Section>
      <Section className="pt-0">
        <div className="max-w-4xl divide-y divide-black/10 border-y border-black/10">
          {copy.entries.map(([date, title, entryCopy], index) => (
            <article key={`${title}-${index}`} className="grid gap-3 py-7 sm:grid-cols-[120px_1fr]">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-black/38">{date}</span>
              <div>
                <h2 className="text-[19px] font-semibold text-[#17171a]">{title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-black/55">{entryCopy}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
