"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * BouncyCardsFeatures — adapted from the 21st.dev community component
 * "Bounce card features" by uniquesonu. Cards scale down + tilt on hover while
 * a gradient panel slides up. Reimplemented on the app's `motion/react`
 * (framer-motion API) and the light brand so it needs no extra dependency.
 */
export interface BouncyCard {
  title: string;
  description: string;
  /** CSS gradient for the panel that slides up on hover. */
  gradient: string;
}

export function BouncyCardsFeatures({
  eyebrow,
  title,
  description,
  cta,
  cards,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  cta?: ReactNode;
  cards: BouncyCard[];
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          {eyebrow && (
            <p className="mono text-[11px] uppercase tracking-[0.22em]" style={{ color: "rgba(23,23,26,0.5)" }}>{eyebrow}</p>
          )}
          <h2 className="mt-2 max-w-xl text-[28px] font-semibold leading-[1.08] tracking-tight sm:text-[40px]" style={{ color: "#17171a" }}>
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed" style={{ color: "rgba(23,23,26,0.58)" }}>{description}</p>
          )}
        </div>
        {cta}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <BounceCard key={i} className={cards.length % 3 === 1 && i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}>
            <CardTitle>{c.title}</CardTitle>
            <div
              className="absolute inset-x-4 bottom-0 top-28 translate-y-8 rounded-t-2xl p-5 transition-transform duration-[250ms] ease-out group-hover:translate-y-4 group-hover:rotate-[2deg]"
              style={{ background: c.gradient }}
            >
              <span className="block text-center text-[14.5px] font-medium leading-snug text-white/95">{c.description}</span>
            </div>
          </BounceCard>
        ))}
      </div>
    </section>
  );
}

function BounceCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 0.96, rotate: "-1deg" }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`group relative min-h-[300px] cursor-default overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.035] p-7 ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mx-auto text-center text-[18px] font-semibold tracking-tight" style={{ color: "#17171a" }}>{children}</h3>
  );
}
