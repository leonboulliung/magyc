import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow, SectionHeading, PlaceholderText, Card } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works — MAGYC",
  description: "From a rough idea to a living, collaborative space in three steps.",
};

const STEPS = [
  { n: "01", title: "Type a rough idea", body: "A sentence is enough. No setup, no template picking." },
  { n: "02", title: "Answer a few questions", body: "MAGYC asks only what it can't infer, then proposes a structure." },
  { n: "03", title: "Get a living space", body: "A themed workspace of fitting elements — shareable and collaborative." },
];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="pt-20 sm:pt-28 pb-10">
        <Eyebrow>How it works</Eyebrow>
        <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(34px, 6vw, 60px)", lineHeight: 1.04, color: brand.ink, maxWidth: 780 }}>
          Idea in, structure out.
        </h1>
        <p className="mt-5 leading-relaxed" style={{ fontSize: 18, color: brand.muted, maxWidth: 620 }}>
          Placeholder overview. Replace with the real narrative and a short demo video.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="grid sm:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <Card key={s.n}>
              <div className="font-mono tracking-widest" style={{ fontSize: 11, color: brand.accent }}>{s.n}</div>
              <h3 className="mt-3 font-semibold" style={{ fontSize: 19, color: brand.ink }}>{s.title}</h3>
              <p className="mt-2 leading-relaxed" style={{ fontSize: 14.5, color: brand.muted }}>{s.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section divider>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <MediaPlaceholder label="Build animation" ratio="16 / 10" caption="Short demo / loop · folgt" />
          <div>
            <SectionHeading eyebrow="Under the hood" title="29+ building blocks, chosen for your idea." />
            <div className="mt-5"><PlaceholderText lines={4} /></div>
          </div>
        </div>
      </Section>

      <Section divider className="text-center">
        <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(26px, 4vw, 40px)", color: brand.ink }}>
          Try it with your own idea.
        </h2>
        <div className="mt-6 flex justify-center">
          <Link href="/#start" className="font-mono uppercase tracking-widest rounded-full px-6 py-3" style={{ fontSize: 12, background: brand.ink, color: brand.bg }}>
            Start now
          </Link>
        </div>
      </Section>
    </>
  );
}
