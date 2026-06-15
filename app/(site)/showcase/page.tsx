import type { Metadata } from "next";
import { Container, Section, Eyebrow } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Showcase — MAGYC",
  description: "Real spaces built with MAGYC, across creative fields.",
};

const SAMPLES = [
  { label: "Brand photo shoot", ratio: "4 / 5" },
  { label: "City film, 2 strangers", ratio: "4 / 5" },
  { label: "Repair-Café launch", ratio: "4 / 5" },
  { label: "Ceramics product drop", ratio: "4 / 5" },
  { label: "Weekend workshop", ratio: "4 / 5" },
  { label: "Festival stand", ratio: "4 / 5" },
];

export default function ShowcasePage() {
  return (
    <>
      <Section className="pt-20 sm:pt-28 pb-8">
        <Eyebrow>Showcase</Eyebrow>
        <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(34px, 6vw, 60px)", lineHeight: 1.04, color: brand.ink, maxWidth: 760 }}>
          Ideas, turned into living spaces.
        </h1>
        <p className="mt-5 leading-relaxed" style={{ fontSize: 18, color: brand.muted, maxWidth: 620 }}>
          A gallery of real MAGYC spaces &mdash; placeholder for now. Real screenshots and creator
          stories will live here.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SAMPLES.map((s, i) => (
            <MediaPlaceholder key={i} label={s.label} ratio={s.ratio} caption="Space preview · folgt" />
          ))}
        </div>
      </Section>
    </>
  );
}
