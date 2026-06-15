import type { Metadata } from "next";
import { Container, Eyebrow, PlaceholderText } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Changelog — MAGYC",
  description: "What's new in MAGYC.",
};

const ENTRIES = [
  { date: "Coming soon", tag: "—" },
  { date: "Coming soon", tag: "—" },
  { date: "Coming soon", tag: "—" },
];

export default function ChangelogPage() {
  return (
    <Container className="pt-16 sm:pt-20 pb-24">
      <Eyebrow>Changelog</Eyebrow>
      <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(30px, 5vw, 46px)", color: brand.ink }}>
        What&rsquo;s new
      </h1>
      <p className="mt-4 leading-relaxed" style={{ fontSize: 17, color: brand.muted, maxWidth: 560 }}>
        Placeholder timeline &mdash; releases will be posted here.
      </p>

      <div className="mt-12 space-y-10" style={{ maxWidth: 720 }}>
        {ENTRIES.map((e, i) => (
          <div key={i} className="grid sm:grid-cols-[160px_1fr] gap-5">
            <div className="font-mono tracking-widest" style={{ fontSize: 12, color: brand.muted }}>{e.date}</div>
            <div>
              <h2 className="font-semibold" style={{ fontSize: 18, color: brand.ink }}>Release title placeholder</h2>
              <div className="mt-3"><PlaceholderText lines={3} short /></div>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
