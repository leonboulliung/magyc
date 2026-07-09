"use client";

import Image from "next/image";
import { useT } from "@/components/i18n/LocaleProvider";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Container } from "@/components/site/sections";
import { SiteReveal } from "@/components/site/SiteReveal";
import { SEGMENTS, type Segment } from "@/lib/segments";

const BLOCK_ICONS: Record<string, string> = {
  deliverables: "ph:package",
  approvals: "ph:seal-check",
  crew: "ph:users-three",
  packages: "ph:stack",
  shotlist: "ph:list-checks",
  schedule: "ph:calendar-check",
  location: "ph:map-pin-line",
  moodboard: "ph:images-square",
  files: "ph:paperclip",
  notes: "ph:note-pencil",
  qa: "ph:question",
  discussion: "ph:chat-circle-dots",
};

const FALLBACK_HERO: Record<string, string> = {
  corporate: "/media/marketing/corporate-fotografie-kachel.jpg",
};

const WORK_MEDIA: Record<string, string[]> = {
  product: ["/media/work-watch.jpg", "/media/work-skincare.jpg", "/media/work-sneaker.jpg"],
  corporate: ["/media/marketing/corporate-fotografie-kachel.jpg", "/media/showcase-08.jpg", "/media/showcase-04.jpg"],
  event: ["/media/showcase-05.jpg", "/media/showcase-02.jpg", "/media/showcase-07.jpg"],
  wedding: ["/media/marketing/hochzeit-fotografie.jpg", "/media/showcase-06.jpg", "/media/showcase-03.jpg"],
  fashion: ["/media/marketing/fashion-fotografie-kachel.jpg", "/media/showcase-09.jpg", "/media/showcase-10.jpg"],
};

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`mono text-[10px] uppercase tracking-[0.22em] ${light ? "text-white/65" : "text-black/42"}`}>{children}</p>;
}

export function SegmentLanding({ segment }: { segment: Segment }) {
  const t = useT();
  const others = SEGMENTS.filter((item) => item.slug !== segment.slug);
  const heroSrc = segment.hero.image?.src ?? FALLBACK_HERO[segment.slug] ?? "/media/marketing/hero-footage.jpg";
  const heroAlt = segment.hero.image?.alt ?? `${segment.label} ${t.marketing.inUse}`;
  const workMedia = segment.work.images?.map((item) => item.src).slice(0, 3) ?? WORK_MEDIA[segment.slug] ?? [];

  return (
    <div className="text-[#17171a]">
      <section className="relative min-h-[560px] overflow-hidden bg-[#17171a] sm:min-h-[620px]">
        <Image src={heroSrc} alt={heroAlt} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/55" aria-hidden />
        <Container className="relative flex min-h-[560px] flex-col justify-end pb-12 pt-24 sm:min-h-[620px] sm:pb-16">
          <SiteReveal>
            <Eyebrow light>{segment.hero.eyebrow}</Eyebrow>
            <h1 className="mt-4 max-w-4xl font-brand text-[40px] font-bold leading-[1.02] text-white sm:text-[68px]">
              {segment.hero.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/75 sm:text-[18px]">{segment.hero.sub}</p>
            <div className="mt-7 flex flex-wrap items-center gap-5">
              <Link href="/#start" className="rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[#17171a] transition-transform hover:-translate-y-0.5">
                {segment.hero.ctaPrimary}
              </Link>
              <Link href="/how-it-works" className="text-[14px] font-medium text-white/75 transition-colors hover:text-white">
                So funktioniert&apos;s <span aria-hidden>→</span>
              </Link>
            </div>
          </SiteReveal>
        </Container>
      </section>

      <Container className="py-20 sm:py-28">
        <SiteReveal>
          <Eyebrow>{segment.problem.eyebrow}</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-brand text-[32px] font-bold leading-[1.08] sm:text-[48px]">{segment.problem.heading}</h2>
        </SiteReveal>
        <div className="mt-10 grid border-y border-black/10 sm:grid-cols-3">
          {segment.problem.cards.map((card, index) => (
            <SiteReveal key={card.big} delay={index * 0.06} className="h-full">
              <div className="h-full px-0 py-7 sm:border-l sm:border-black/10 sm:px-7 sm:first:border-l-0">
                <span className="mono text-[10px] tracking-widest text-black/35">0{index + 1}</span>
                <h3 className="mt-4 text-[19px] font-semibold">{card.big}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-black/55">{card.small}</p>
              </div>
            </SiteReveal>
          ))}
        </div>
      </Container>

      <section className="bg-[#e9e8e3] py-20 sm:py-28">
        <Container>
          <SiteReveal>
            <Eyebrow>{segment.work.eyebrow}</Eyebrow>
            <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <h2 className="max-w-3xl font-brand text-[32px] font-bold leading-[1.08] sm:text-[48px]">{segment.work.heading}</h2>
              <p className="max-w-sm text-[15px] leading-relaxed text-black/55">{segment.work.lead}</p>
            </div>
          </SiteReveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {workMedia.map((src, index) => (
              <SiteReveal key={src} delay={index * 0.06}>
                <div className="relative aspect-[4/5] overflow-hidden bg-black">
                  <Image src={src} alt={`${segment.label}, Arbeitsbeispiel ${index + 1}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-700 hover:scale-[1.025]" />
                </div>
              </SiteReveal>
            ))}
          </div>
        </Container>
      </section>

      <Container className="py-20 sm:py-28">
        <SiteReveal>
          <Eyebrow>{t.marketing.threePhases}</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-brand text-[32px] font-bold leading-[1.08] sm:text-[48px]">{t.marketing.fromIdeaToClose}</h2>
        </SiteReveal>
        <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
          {[
            ["01", t.marketing.planningTitle, t.marketing.planningBody],
            ["02", t.marketing.contractTitle, t.marketing.contractBody],
            ["03", t.marketing.closedTitle, t.marketing.closedBody],
          ].map(([number, title, copy], index) => (
            <SiteReveal key={number} delay={index * 0.05}>
              <div className="grid gap-3 py-7 sm:grid-cols-[80px_220px_1fr] sm:items-center">
                <span className="mono text-[10px] tracking-widest text-black/35">{number}</span>
                <h3 className="text-[20px] font-semibold">{title}</h3>
                <p className="max-w-2xl text-[14px] leading-relaxed text-black/55">{copy}</p>
              </div>
            </SiteReveal>
          ))}
        </div>
      </Container>

      <section className="bg-white py-20 sm:py-28">
        <Container>
          <SiteReveal>
            <Eyebrow>{segment.blocks.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-brand text-[32px] font-bold leading-[1.08] sm:text-[48px]">{segment.blocks.heading}</h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-black/55">{segment.blocks.lead}</p>
          </SiteReveal>
          <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
            {segment.blocks.items.map((item, index) => (
              <SiteReveal key={`${item.name}-${index}`} delay={(index % 3) * 0.04} className="h-full bg-white">
                <div className="h-full p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#17171a] text-white">
                    <Icon icon={BLOCK_ICONS[item.icon] ?? "ph:square"} width="19" height="19" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-[17px] font-semibold">{item.name}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-black/52">{item.role}</p>
                </div>
              </SiteReveal>
            ))}
          </div>
        </Container>
      </section>

      <Container className="py-20 sm:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SiteReveal>
            <Eyebrow>{segment.present.eyebrow}</Eyebrow>
            <h2 className="mt-4 font-brand text-[32px] font-bold leading-[1.08] sm:text-[48px]">{segment.present.heading}</h2>
            <p className="mt-5 text-[16px] leading-relaxed text-black/55">{segment.present.sub}</p>
          </SiteReveal>
          <SiteReveal delay={0.08}>
            <div className="relative aspect-[16/10] overflow-hidden bg-black">
              <Image src="/media/marketing/finale-uebergabe.png" alt={t.marketing.handoverAlt} fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
            </div>
          </SiteReveal>
        </div>
      </Container>

      <Container className="pb-24 sm:pb-32">
        <SiteReveal>
          <div className="grid bg-[#17171a] text-white lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="p-7 sm:p-11">
              <Eyebrow light>{segment.positioning.eyebrow}</Eyebrow>
              <h2 className="mt-4 max-w-3xl font-brand text-[30px] font-bold leading-[1.08] sm:text-[46px]">{segment.cta.headline}</h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/65">{segment.positioning.sub}</p>
            </div>
            <div className="p-7 pt-0 sm:p-11 sm:pt-0 lg:pt-11">
              <Link href="/#start" className="inline-flex rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[#17171a] transition-transform hover:-translate-y-0.5">{segment.cta.button}</Link>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="mono mr-3 text-[10px] uppercase tracking-[0.2em] text-black/40">{t.marketing.alsoFor}</span>
            {others.map((item) => (
              <Link key={item.slug} href={`/${item.slug}`} className="rounded-full border border-black/12 px-4 py-2 text-[13px] text-black/65 transition-colors hover:border-black/35 hover:text-black">{item.label}</Link>
            ))}
          </div>
        </SiteReveal>
      </Container>
    </div>
  );
}
