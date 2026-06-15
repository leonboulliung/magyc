import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/site/sections";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — MAGYC",
  description: "Get in touch.",
};

const inputStyle = {
  border: `1px solid ${brand.rule}`,
  background: brand.surface,
  borderRadius: 12,
  padding: "11px 13px",
  fontSize: 15,
  color: brand.ink,
  width: "100%",
} as const;

const labelStyle = { fontSize: 12, color: brand.muted } as const;

export default function ContactPage() {
  return (
    <Section className="pt-20 sm:pt-28">
      <div className="grid lg:grid-cols-2 gap-12">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.05, color: brand.ink }}>
            Say hello.
          </h1>
          <p className="mt-5 leading-relaxed" style={{ fontSize: 17, color: brand.muted, maxWidth: 420 }}>
            Placeholder. The form below is a visual scaffold &mdash; wiring (email / inbox) comes later.
          </p>
          <div className="mt-8 space-y-3">
            <div>
              <div className="font-mono uppercase tracking-widest" style={labelStyle}>Email</div>
              <div style={{ fontSize: 16, color: brand.ink }}>hello@magyc.site &middot; placeholder</div>
            </div>
          </div>
        </div>

        {/* Visual form scaffold — intentionally inert for now. */}
        <form className="space-y-4" aria-label="contact form (placeholder)" onSubmit={undefined}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} placeholder="Your name" disabled />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} placeholder="you@example.com" disabled />
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <textarea style={{ ...inputStyle, minHeight: 130, resize: "none" }} placeholder="What's on your mind?" disabled />
          </div>
          <button
            type="button"
            className="font-mono uppercase tracking-widest rounded-full px-6 py-3"
            style={{ fontSize: 12, background: brand.ink, color: brand.bg, opacity: 0.5, cursor: "not-allowed" }}
            disabled
          >
            Send (soon)
          </button>
        </form>
      </div>
    </Section>
  );
}
