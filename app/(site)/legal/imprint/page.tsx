import type { Metadata } from "next";
import { Container, PlaceholderText } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = { title: "Imprint — MAGYC" };

export default function ImprintPage() {
  return (
    <Container className="pt-16 sm:pt-20 pb-24" >
      <p className="font-mono uppercase tracking-widest" style={{ fontSize: 11, color: brand.accent }}>Legal</p>
      <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(30px, 5vw, 44px)", color: brand.ink }}>Imprint</h1>
      <p className="mt-4 rounded-xl p-4" style={{ fontSize: 13, color: brand.muted, background: brand.accentSoft, border: `1px dashed ${brand.rule}`, maxWidth: 680 }}>
        Placeholder. The binding imprint (§5 DDG / TMG: operator, address, contact, represented by,
        register, VAT-ID) must be filled in and legally reviewed before launch.
      </p>
      <div className="mt-10 space-y-8" style={{ maxWidth: 680 }}>
        {["Angaben gemäß §5 DDG", "Kontakt", "Vertreten durch", "Haftung & Verantwortlich"].map((h) => (
          <section key={h}>
            <h2 className="font-semibold" style={{ fontSize: 18, color: brand.ink }}>{h}</h2>
            <div className="mt-3"><PlaceholderText lines={2} short /></div>
          </section>
        ))}
      </div>
    </Container>
  );
}
