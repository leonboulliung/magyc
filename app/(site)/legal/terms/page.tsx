import type { Metadata } from "next";
import { Container, PlaceholderText } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = { title: "Terms — MAGYC" };

export default function TermsPage() {
  return (
    <Container className="pt-16 sm:pt-20 pb-24">
      <p className="font-mono uppercase tracking-widest" style={{ fontSize: 11, color: brand.accent }}>Legal</p>
      <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(30px, 5vw, 44px)", color: brand.ink }}>Terms of Service</h1>
      <p className="mt-4 rounded-xl p-4" style={{ fontSize: 13, color: brand.muted, background: brand.accentSoft, border: `1px dashed ${brand.rule}`, maxWidth: 680 }}>
        Placeholder. Binding terms (acceptable use, content ownership, AI-output disclaimer,
        liability, termination) must be written and legally reviewed before launch.
      </p>
      <div className="mt-10 space-y-8" style={{ maxWidth: 680 }}>
        {["Using MAGYC", "Your content", "AI-generated output", "Acceptable use", "Liability", "Changes to these terms"].map((h) => (
          <section key={h}>
            <h2 className="font-semibold" style={{ fontSize: 18, color: brand.ink }}>{h}</h2>
            <div className="mt-3"><PlaceholderText lines={3} short /></div>
          </section>
        ))}
      </div>
    </Container>
  );
}
