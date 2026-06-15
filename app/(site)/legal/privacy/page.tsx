import type { Metadata } from "next";
import { Container, PlaceholderText } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy — MAGYC" };

export default function PrivacyPage() {
  return (
    <Container className="pt-16 sm:pt-20 pb-24">
      <p className="font-mono uppercase tracking-widest" style={{ fontSize: 11, color: brand.accent }}>Legal</p>
      <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(30px, 5vw, 44px)", color: brand.ink }}>Privacy Policy</h1>
      <p className="mt-4 rounded-xl p-4" style={{ fontSize: 13, color: brand.muted, background: brand.accentSoft, border: `1px dashed ${brand.rule}`, maxWidth: 680 }}>
        Placeholder. A real GDPR-compliant policy is required &mdash; it must cover the actual data
        flows (Clerk auth, Supabase storage, OpenAI processing, Vercel hosting, Giphy/Wikipedia/Photon
        requests) and be legally reviewed before launch.
      </p>
      <div className="mt-10 space-y-8" style={{ maxWidth: 680 }}>
        {["Responsible party", "What we collect", "Third-party processors", "Cookies & local storage", "Your rights", "Contact"].map((h) => (
          <section key={h}>
            <h2 className="font-semibold" style={{ fontSize: 18, color: brand.ink }}>{h}</h2>
            <div className="mt-3"><PlaceholderText lines={3} short /></div>
          </section>
        ))}
      </div>
    </Container>
  );
}
