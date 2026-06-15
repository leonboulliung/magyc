import type { Metadata } from "next";
import { Container, Eyebrow, PlaceholderText } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs — MAGYC",
  description: "Guides and reference for MAGYC.",
};

const SIDEBAR = [
  { group: "Start", items: ["Introduction", "Your first space", "Sharing"] },
  { group: "Elements", items: ["Overview", "Collaboration", "Media & maps"] },
  { group: "Reference", items: ["Project modes", "The assistant", "Publishing"] },
];

export default function DocsPage() {
  return (
    <Container className="pt-16 sm:pt-20 pb-24">
      <Eyebrow>Docs</Eyebrow>
      <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(30px, 5vw, 46px)", color: brand.ink }}>
        Documentation
      </h1>
      <p className="mt-4 leading-relaxed" style={{ fontSize: 17, color: brand.muted, maxWidth: 560 }}>
        Structure placeholder &mdash; real guides will be written page by page.
      </p>

      <div className="mt-12 grid lg:grid-cols-[220px_1fr] gap-10">
        {/* Sidebar */}
        <nav className="space-y-6">
          {SIDEBAR.map((s) => (
            <div key={s.group}>
              <h2 className="font-mono uppercase tracking-widest" style={{ fontSize: 10, color: brand.muted }}>{s.group}</h2>
              <ul className="mt-2.5 space-y-1.5">
                {s.items.map((it) => (
                  <li key={it} style={{ fontSize: 14, color: brand.ink, opacity: 0.7 }}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Content */}
        <article className="space-y-6" style={{ maxWidth: 680 }}>
          <h2 className="font-semibold" style={{ fontSize: 24, color: brand.ink }}>Introduction</h2>
          <PlaceholderText lines={4} />
          <h3 className="font-semibold pt-2" style={{ fontSize: 18, color: brand.ink }}>A worked example</h3>
          <PlaceholderText lines={5} />
          <div className="rounded-xl p-4 font-mono" style={{ background: brand.surface, border: `1px solid ${brand.rule}`, fontSize: 13, color: brand.muted }}>
            // code / example block placeholder
          </div>
          <PlaceholderText lines={3} short />
        </article>
      </div>
    </Container>
  );
}
