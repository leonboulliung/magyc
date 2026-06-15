import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Section, Eyebrow, SectionHeading, PlaceholderText, Card } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { AREAS, areaBySlug, brand } from "@/lib/site";

export function generateStaticParams() {
  return AREAS.map((a) => ({ area: a.slug }));
}

export function generateMetadata({ params }: { params: { area: string } }): Metadata {
  const area = areaBySlug(params.area);
  return {
    title: area ? `MAGYC for ${area.label}` : "MAGYC",
    description: area?.tagline,
  };
}

export default function AreaPage({ params }: { params: { area: string } }) {
  const area = areaBySlug(params.area);
  if (!area) notFound();

  return (
    <>
      {/* Hero */}
      <Section className="pt-20 sm:pt-28 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Eyebrow>For {area.label.toLowerCase()}</Eyebrow>
            <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 54px)", lineHeight: 1.05, color: brand.ink }}>
              {area.tagline}
            </h1>
            <p className="mt-5 leading-relaxed" style={{ fontSize: 18, color: brand.muted, maxWidth: 520 }}>
              Placeholder positioning for {area.label.toLowerCase()}. Replace with the real promise,
              proof, and a creator quote.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <Link href="/#start" className="font-mono uppercase tracking-widest rounded-full px-5 py-3" style={{ fontSize: 12, background: brand.ink, color: brand.bg }}>
                Start a {area.label.toLowerCase()} space
              </Link>
              <Link href="/showcase" className="font-mono uppercase tracking-widest" style={{ fontSize: 12, color: brand.muted }}>
                See examples →
              </Link>
            </div>
          </div>
          <MediaPlaceholder label={`${area.label} hero`} ratio="4 / 5" caption="Creative image · folgt" />
        </div>
      </Section>

      {/* Three placeholder value props */}
      <Section divider className="py-16">
        <SectionHeading eyebrow="Why MAGYC" title={`Built for the way ${area.label.toLowerCase()} actually works.`} />
        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="font-mono tracking-widest" style={{ fontSize: 11, color: brand.accent }}>0{i}</div>
              <h3 className="mt-3 font-semibold" style={{ fontSize: 18, color: brand.ink }}>Benefit {i}</h3>
              <div className="mt-3"><PlaceholderText lines={3} short /></div>
            </Card>
          ))}
        </div>
      </Section>

      {/* A worked example placeholder */}
      <Section divider>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <MediaPlaceholder label={`${area.label} space`} ratio="16 / 10" caption="Annotated space screenshot · folgt" />
          <div>
            <SectionHeading eyebrow="In practice" title="From rough idea to a sharable workspace." />
            <div className="mt-5"><PlaceholderText lines={4} /></div>
          </div>
        </div>
      </Section>

      {/* Other areas */}
      <Section divider>
        <Eyebrow>More areas</Eyebrow>
        <div className="mt-5 flex flex-wrap gap-3">
          {AREAS.filter((a) => a.slug !== area.slug).map((a) => (
            <Link key={a.slug} href={`/for/${a.slug}`} className="rounded-full px-4 py-2" style={{ fontSize: 14, border: `1px solid ${brand.rule}`, color: brand.ink }}>
              {a.label}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
