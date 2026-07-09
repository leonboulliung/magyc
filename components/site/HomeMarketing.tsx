"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { MediaFrame } from "@/components/site/MediaFrame";
import { SiteFooter } from "@/components/site/SiteFooter";
import { USE_CASES } from "@/lib/site";
import type { MediaKey } from "@/lib/siteMedia";
import { useT } from "@/components/i18n/LocaleProvider";

// Non-translatable metadata; the title/body copy comes from the dictionary
// (t.home.problems / .features / .steps) and is merged by index.
const PROBLEM_ICONS = ["ph:chat-circle-dots", "ph:stack", "ph:seal-check"] as const;
const FEATURE_META = [
  { icon: "ph:list-checks", accent: "#5b7cfa" },
  { icon: "ph:map-pin-line", accent: "#2bb89c" },
  { icon: "ph:calendar-check", accent: "#d89a24" },
  { icon: "ph:check-circle", accent: "#df668c" },
] as const;
const STEP_META = [
  { n: "01", media: "behindScenes" as const },
  { n: "02", media: "projectPageStill" as const },
  { n: "03", media: "alignment" as const },
  { n: "04", media: "handoff" as const },
] as const;

const USE_CASE_MEDIA: Record<string, MediaKey> = {
  "/product": "productTile",
  "/event": "eventTile",
  "/wedding": "weddingTile",
  "/corporate": "corporateTile",
  "/fashion": "fashionTile",
};

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</section>;
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-[10px] uppercase tracking-[0.22em] text-black/42 sm:text-[11px]">{children}</p>;
}

export function HomeMarketing() {
  const t = useT();
  return (
    <div className="relative w-full pt-20 sm:pt-28">
      <Section>
        <div className="grid gap-10 border-y border-black/10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-16">
          <Reveal>
            <Eyebrow>{t.home.eyebrowWork}</Eyebrow>
            <h2 className="mt-4 max-w-xl font-brand text-[30px] font-bold leading-[1.08] text-[#17171a] sm:text-[46px]">
              {t.home.heroTitle}
            </h2>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-black/58">
              {t.home.heroBody}
            </p>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
            {t.home.problems.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.07}>
                <div className="flex gap-4 border-t border-black/10 pt-5 first:border-0 first:pt-0 sm:block sm:border-0 sm:pt-0 lg:flex lg:border-t lg:pt-5 lg:first:border-0 lg:first:pt-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#17171a] text-white">
                    <Icon icon={PROBLEM_ICONS[index]} width="19" height="19" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#17171a]">{item.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-black/52">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section className="pt-20 sm:pt-28">
        <Reveal>
          <Eyebrow>{t.home.eyebrowRequest}</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-brand text-[30px] font-bold leading-[1.08] text-[#17171a] sm:text-[46px]">
            {t.home.requestTitle}
          </h2>
        </Reveal>
        <div className="mt-9 grid items-stretch gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <Reveal>
            <div className="flex h-full min-h-[320px] flex-col justify-between bg-[#ede8e0] p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[12px] text-black/45">
                <Icon icon="ph:chat-circle-text" width="18" height="18" aria-hidden />
                {t.home.requestLabel}
              </div>
              <blockquote className="mt-10 font-brand text-[24px] font-medium leading-[1.25] text-[#17171a] sm:text-[30px]">
                {t.home.requestQuote}
              </blockquote>
              <p className="mt-8 text-[13px] leading-relaxed text-black/48">{t.home.requestCaption}</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="relative h-full overflow-hidden bg-[#101112]">
              <MediaFrame media="projectPage" ratio="16 / 10" className="h-full [&_div]:h-full [&_div]:rounded-none [&_video]:min-h-full" sizes="(max-width:1024px) 100vw, 62vw" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-black/75 p-5 text-white sm:p-6">
                <div>
                  <p className="mono text-[9px] uppercase tracking-[0.2em] text-white/52">{t.home.workspaceLabel}</p>
                  <p className="mt-1 text-[15px] font-medium">{t.home.workspaceItems}</p>
                </div>
                <Icon icon="ph:arrow-up-right" width="22" height="22" aria-hidden className="shrink-0 text-white/70" />
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section className="pt-20 sm:pt-28">
        <Reveal>
          <Eyebrow>{t.home.eyebrowAllInOne}</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-brand text-[30px] font-bold leading-[1.08] text-[#17171a] sm:text-[46px]">
            {t.home.allInOneTitle}
          </h2>
        </Reveal>
        <div className="mt-9 grid gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-7 lg:row-span-2">
            <div className="h-full overflow-hidden border border-black/10 bg-white">
              <MediaFrame media="moodboard" ratio="16 / 10" className="[&_div]:rounded-none" sizes="(max-width:1024px) 100vw, 60vw" />
              <div className="flex gap-4 p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#8b7bff]/12 text-[#6554e8]">
                  <Icon icon="ph:images-square" width="21" height="21" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#17171a]">{t.home.moodboardTitle}</h3>
                  <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-black/52">{t.home.moodboardBody}</p>
                </div>
              </div>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5">
            {t.home.features.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <div className="h-full border border-black/10 bg-white p-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(20,20,24,0.08)]">
                  <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: `${FEATURE_META[index].accent}18`, color: FEATURE_META[index].accent }}>
                    <Icon icon={FEATURE_META[index].icon} width="19" height="19" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-[16px] font-semibold text-[#17171a]">{feature.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-black/52">{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="lg:col-span-5" delay={0.12}>
            <div className="flex h-full min-h-[170px] items-end justify-between gap-8 bg-[#17171a] p-6 text-white">
              <div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
                  <Icon icon="ph:signature" width="20" height="20" aria-hidden />
                </span>
                <h3 className="mt-5 text-[18px] font-semibold">{t.home.contractTitle}</h3>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/62">{t.home.contractBody}</p>
              </div>
              <Icon icon="ph:arrow-right" width="24" height="24" aria-hidden className="shrink-0 text-white/55" />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section className="pt-20 sm:pt-28">
        <Reveal>
          <Eyebrow>{t.home.eyebrowHow}</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-brand text-[30px] font-bold leading-[1.08] text-[#17171a] sm:text-[46px]">
            {t.home.howTitle}
          </h2>
        </Reveal>
        <div className="mt-9 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.steps.map((step, index) => (
            <Reveal key={STEP_META[index].n} delay={index * 0.07}>
              <div className="group">
                <div className="overflow-hidden bg-black">
                  <MediaFrame media={STEP_META[index].media} ratio="4 / 3" className="[&_div]:rounded-none [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.025]" sizes="(max-width:1024px) 50vw, 25vw" />
                </div>
                <div className="mt-5 flex gap-3 border-t border-black/12 pt-4">
                  <span className="mono text-[10px] tracking-widest text-black/34">{STEP_META[index].n}</span>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#17171a]">{step.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-black/52">{step.body}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="pt-20 sm:pt-28">
        <Reveal>
          <Eyebrow>{t.home.eyebrowForYou}</Eyebrow>
          <h2 className="mt-4 font-brand text-[30px] font-bold leading-[1.08] text-[#17171a] sm:text-[46px]">{t.home.forYouTitle}</h2>
        </Reveal>
        <div className="mt-9 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {USE_CASES.map((useCase, index) => (
            <Reveal key={useCase.href} delay={index * 0.05}>
              <Link href={useCase.href} className="group block overflow-hidden bg-white">
                <MediaFrame media={USE_CASE_MEDIA[useCase.href] ?? "shootingSetup"} ratio="4 / 5" className="[&_div]:rounded-none [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.035]" sizes="(max-width:1024px) 50vw, 20vw" />
                <div className="flex items-center justify-between border-x border-b border-black/10 px-4 py-3.5">
                  <span className="text-[14px] font-semibold text-[#17171a] sm:text-[15px]">{useCase.label}</span>
                  <Icon icon="ph:arrow-up-right" width="17" height="17" aria-hidden className="text-black/38 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="pb-24 pt-20 sm:pb-28 sm:pt-28">
        <Reveal>
          <div className="grid overflow-hidden bg-[#17171a] text-white lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="p-7 sm:p-11">
              <Eyebrow><span className="text-white/48">{t.home.eyebrowCta}</span></Eyebrow>
              <h2 className="mt-4 max-w-2xl font-brand text-[30px] font-bold leading-[1.08] sm:text-[46px]">{t.home.ctaTitle}</h2>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/62">{t.home.ctaBody}</p>
            </div>
            <div className="flex gap-3 p-7 pt-0 sm:p-11 sm:pt-0 lg:pt-11">
              <Link href="/#start" className="rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[#17171a] transition-transform hover:-translate-y-0.5">{t.home.ctaPlan}</Link>
              <Link href="/showcase" className="rounded-full border border-white/22 px-5 py-3 text-[14px] font-medium text-white/78 transition-colors hover:border-white/45 hover:text-white">{t.home.ctaExample}</Link>
            </div>
          </div>
        </Reveal>
      </Section>

      <SiteFooter />
    </div>
  );
}
