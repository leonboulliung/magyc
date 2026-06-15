import type { Metadata } from "next";
import { Section, Eyebrow, PlaceholderText } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Roadmap — MAGYC",
  description: "What we're building now, next, and later.",
};

const COLUMNS: { title: string; items: string[] }[] = [
  { title: "Now", items: ["Element iteration & polish", "Guided project intake", "Admin observability"] },
  { title: "Next", items: ["Persistent assistant actions", "Streamed space creation", "Realtime config sync"] },
  { title: "Later", items: ["MAGYC CLI", "Public API", "Mobile app"] },
];

export default function RoadmapPage() {
  return (
    <>
      <Section className="pt-20 sm:pt-28 pb-10">
        <Eyebrow>Roadmap</Eyebrow>
        <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(34px, 6vw, 60px)", lineHeight: 1.04, color: brand.ink, maxWidth: 780 }}>
          Where MAGYC is heading.
        </h1>
        <p className="mt-5 leading-relaxed" style={{ fontSize: 18, color: brand.muted, maxWidth: 620 }}>
          Placeholder roadmap &mdash; directional, not committed dates. The items below are examples.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="grid sm:grid-cols-3 gap-5">
          {COLUMNS.map((col) => (
            <div key={col.title} className="rounded-2xl p-5" style={{ border: `1px solid ${brand.rule}`, background: brand.surface }}>
              <h2 className="font-mono uppercase tracking-widest" style={{ fontSize: 11, color: brand.accent }}>{col.title}</h2>
              <ul className="mt-4 space-y-3">
                {col.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5" style={{ fontSize: 15, color: brand.ink }}>
                    <span style={{ color: brand.muted }}>—</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 font-mono" style={{ fontSize: 12, color: brand.muted }}>
          Note: the MAGYC CLI is on the &ldquo;Later&rdquo; track — placeholder until scoped.
        </p>
      </Section>
    </>
  );
}
