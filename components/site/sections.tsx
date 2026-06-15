import type { ReactNode } from "react";
import { brand } from "@/lib/site";

/** Centered content column with consistent horizontal padding. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 ${className ?? ""}`}>{children}</div>;
}

/** A vertical section band with generous rhythm. */
export function Section({
  children,
  className,
  bg,
  divider,
}: {
  children: ReactNode;
  className?: string;
  bg?: string;
  divider?: boolean;
}) {
  return (
    <section
      className={`py-16 sm:py-24 ${className ?? ""}`}
      style={{ background: bg, borderTop: divider ? `1px solid ${brand.rule}` : undefined }}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Small mono uppercase label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono uppercase tracking-[0.22em]" style={{ fontSize: 11, color: brand.accent }}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="max-w-2xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className="mt-3 font-semibold tracking-tight"
        style={{ fontSize: "clamp(26px, 4vw, 40px)", lineHeight: 1.08, color: brand.ink }}
      >
        {title}
      </h2>
      {lead && (
        <p className="mt-4 leading-relaxed" style={{ fontSize: 17, color: brand.muted }}>
          {lead}
        </p>
      )}
    </header>
  );
}

/** Marks placeholder body copy so it's obvious what's still to be written. */
export function PlaceholderText({ lines = 3, short }: { lines?: number; short?: boolean }) {
  return (
    <div className="space-y-2.5" aria-label="placeholder text">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            height: 11,
            width: i === lines - 1 ? (short ? "38%" : "62%") : "100%",
            background: brand.rule,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

/** A simple bordered card used across the marketing pages. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className ?? ""}`}
      style={{ background: brand.surface, border: `1px solid ${brand.rule}` }}
    >
      {children}
    </div>
  );
}
