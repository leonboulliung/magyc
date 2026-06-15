import type { Metadata } from "next";
import { Section, Eyebrow, SectionHeading, PlaceholderText } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Story — MAGYC",
  description: "Why MAGYC exists.",
};

export default function StoryPage() {
  return (
    <>
      <Section className="pt-20 sm:pt-28 pb-10">
        <Eyebrow>Story</Eyebrow>
        <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(34px, 6vw, 60px)", lineHeight: 1.04, color: brand.ink, maxWidth: 780 }}>
          Why we built MAGYC.
        </h1>
      </Section>

      <Section className="pt-0">
        <MediaPlaceholder label="Founder / origin image" ratio="16 / 9" caption="Real image · folgt" />
        <div className="mt-10 grid lg:grid-cols-[200px_1fr] gap-8">
          <div className="font-mono uppercase tracking-widest" style={{ fontSize: 11, color: brand.muted }}>The origin</div>
          <div className="space-y-6" style={{ maxWidth: 640 }}>
            <PlaceholderText lines={4} />
            <PlaceholderText lines={5} />
            <PlaceholderText lines={3} short />
          </div>
        </div>
      </Section>

      <Section divider>
        <SectionHeading eyebrow="What we believe" title="Tools should meet your idea, not the other way around." />
        <div className="mt-6" style={{ maxWidth: 640 }}><PlaceholderText lines={4} /></div>
      </Section>
    </>
  );
}
