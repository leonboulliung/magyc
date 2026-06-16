import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { SiteImage } from "@/components/site/SiteImage";
import { EmergentBackdrop } from "@/components/site/EmergentBackdrop";
import { SEGMENTS, type Segment } from "@/lib/segments";

/** Building-block line icons, keyed by Segment block `icon`. Paths are
 *  pipe-separated <path> definitions. */
const ICONS: Record<string, string> = {
  deliverables: "M4 7l8-4 8 4-8 4-8-4z|M4 7v10l8 4 8-4V7|M12 11v10",
  approvals: "M4 12l5 5L20 6",
  crew: "M9 8a3 3 0 1 0 0-.01|M3.5 19a5.5 5.5 0 0 1 11 0|M16 6a3 3 0 0 1 0 6|M21 19a5.5 5.5 0 0 0-4-5.3",
  packages: "M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5",
  shotlist: "M9 6h11|M9 12h11|M9 18h11|M4 5.5l1 1 2-2|M4 11.5l1 1 2-2|M4 17.5l1 1 2-2",
  schedule: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M3 9h18|M8 2v4|M16 2v4",
  location: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z|M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  moodboard: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 17l-5-5L5 21",
  files: "M21 12.5L12.5 21a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.6 1.6 0 0 1-2.3-2.3l8-8",
  notes: "M12 20h9|M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
  qa: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M9.3 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1 .8-1 1.6",
  discussion: "M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z|M8.5 12h7",
};

function Icon({ k }: { k: string }) {
  const d = ICONS[k] ?? "";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/55">{children}</p>;
}

/**
 * SegmentLanding — one renderer for every photography-segment marketing
 * page. Content comes from a Segment (lib/segments.ts); the engine story
 * is shared, the message is differentiated per bottleneck. Imagery is
 * optional — missing images render labelled placeholders.
 */
export function SegmentLanding({ segment }: { segment: Segment }) {
  const others = SEGMENTS.filter((s) => s.slug !== segment.slug);

  return (
    <div className="relative">
      <EmergentBackdrop />

      <div className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <Container className="pt-32 sm:pt-40 pb-12 sm:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Eyebrow>{segment.hero.eyebrow}</Eyebrow>
              <h1 className="mt-5 font-heading text-[40px] italic leading-[1.0] tracking-[-0.01em] text-white sm:text-[64px]">
                {segment.hero.headline}
              </h1>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-white/70 sm:text-[20px]">
                {segment.hero.sub}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link href="/#start" className="liquid-glass-strong rounded px-5 py-2.5 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]">
                  {segment.hero.ctaPrimary}
                </Link>
                <Link href="/showcase" className="mono text-[12px] uppercase tracking-widest text-white/55 hover:text-white">
                  {segment.hero.ctaSecondary}
                </Link>
              </div>
            </div>
            {segment.hero.image ? (
              <SiteImage
                src={segment.hero.image.src}
                alt={segment.hero.image.alt}
                ratio="4 / 5"
                caption={segment.hero.image.caption}
                sizes="(max-width: 1024px) 100vw, 45vw"
                priority
              />
            ) : (
              <MediaPlaceholder label={segment.hero.placeholderLabel ?? "Hero"} ratio="4 / 5" caption="Echtes Bild · folgt" />
            )}
          </div>
        </Container>

        {/* ── Das Problem ──────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>{segment.problem.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              {segment.problem.heading}
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {segment.problem.cards.map((c) => (
                <div key={c.big} className="bg-black/40 p-6">
                  <div className="font-heading text-[24px] italic text-white sm:text-[28px]">{c.big}</div>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/60">{c.small}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── Sample work ──────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>{segment.work.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[40px]">
              {segment.work.heading}
            </h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/65">{segment.work.lead}</p>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
              {segment.work.images
                ? segment.work.images.map((w) => (
                    <SiteImage key={w.src} src={w.src} alt={w.alt} ratio="1 / 1" sizes="(max-width: 1024px) 50vw, 33vw" />
                  ))
                : (segment.work.placeholderLabels ?? []).map((label, i) => (
                    <MediaPlaceholder key={`${label}-${i}`} label={label} ratio="1 / 1" />
                  ))}
            </div>
            <p className="mono mt-5 text-[11px] uppercase tracking-[0.2em] text-white/35">{segment.work.footnote}</p>
          </div>
        </Container>

        {/* ── Lebenszyklus ─────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>{segment.lifecycle.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              {segment.lifecycle.heading}
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {segment.lifecycle.steps.map((s) => (
                <div key={s.n} className="liquid-glass rounded-2xl p-6">
                  <div className="mono text-[12px] tracking-widest text-white/40">{s.n}</div>
                  <h3 className="mt-3 font-heading text-[26px] italic text-white">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/68">{s.lead}</p>
                  <p className="mt-4 text-[13px] leading-relaxed text-white/45">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── Bausteine ────────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>{segment.blocks.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              {segment.blocks.heading}
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/68">{segment.blocks.lead}</p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {segment.blocks.items.map((b) => (
                <div key={b.name} className="bg-black/40 p-6 transition-colors duration-200 hover:bg-black/20">
                  <div className="text-white/85"><Icon k={b.icon} /></div>
                  <h3 className="mt-4 font-body text-[16px] font-medium text-white">{b.name}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{b.role}</p>
                </div>
              ))}
            </div>
            <p className="mono mt-6 text-[11px] uppercase tracking-[0.2em] text-white/35">{segment.blocks.footnote}</p>
          </div>
        </Container>

        {/* ── Present ──────────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Eyebrow>{segment.present.eyebrow}</Eyebrow>
                <h2 className="mt-4 font-heading text-[30px] italic leading-[1.08] text-white sm:text-[46px]">
                  {segment.present.heading}
                </h2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">{segment.present.sub}</p>
                <div className="mt-8 flex items-center gap-3 text-[13px] text-white/50">
                  <span className="mono rounded border border-white/15 px-2.5 py-1 tracking-widest">{segment.present.fromLabel}</span>
                  <span aria-hidden className="text-white/30">→</span>
                  <span className="mono rounded border border-white/15 px-2.5 py-1 tracking-widest text-white/80">{segment.present.toLabel}</span>
                </div>
              </div>
              <MediaPlaceholder label={segment.present.mediaLabel} ratio="4 / 3" caption={segment.present.mediaCaption} />
            </div>
          </div>
        </Container>

        {/* ── Positionierung ───────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="liquid-glass rounded-2xl border-t border-white/10 p-8 sm:p-12">
            <Eyebrow>{segment.positioning.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-[28px] italic leading-[1.1] text-white sm:text-[40px]">
              {segment.positioning.heading}
            </h2>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-white/70">{segment.positioning.sub}</p>
          </div>
        </Container>

        {/* ── CTA + andere Segmente ────────────────────────────── */}
        <Container className="pb-28 pt-8 text-center sm:pb-36">
          <h2 className="mx-auto max-w-2xl font-heading text-[32px] italic leading-[1.05] text-white sm:text-[52px]">
            {segment.cta.headline}
          </h2>
          <div className="mt-9 flex items-center justify-center">
            <Link href="/#start" className="liquid-glass-strong rounded px-6 py-3 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]">
              {segment.cta.button}
            </Link>
          </div>
          {others.length > 0 && (
            <div className="mt-14">
              <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/40">Auch für</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {others.map((o) => (
                  <Link key={o.slug} href={`/${o.slug}`} className="rounded-full border border-white/15 px-4 py-2 text-[14px] text-white/80 transition-colors hover:border-white/40 hover:text-white">
                    {o.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Container>
      </div>
    </div>
  );
}
