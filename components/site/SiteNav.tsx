"use client";

import { useState } from "react";
import Link from "next/link";
import { brand, NAV_LINKS } from "@/lib/site";

/**
 * SiteNav — the marketing-site top bar. Sticky, translucent, with the
 * serif wordmark, primary links, and a "Start" CTA into the tool. On
 * phones the links collapse into a simple toggled sheet.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "color-mix(in srgb, #f5f3ee 86%, transparent)",
        borderBottom: `1px solid ${brand.rule}`,
        backdropFilter: "blur(10px)",
      }}
    >
      <nav className="mx-auto w-full max-w-6xl px-5 sm:px-8 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-serif" style={{ fontSize: 22, color: brand.ink, letterSpacing: "-0.01em" }}>
          magyc
        </Link>

        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-opacity hover:opacity-100"
              style={{ fontSize: 14, color: brand.muted, opacity: 0.85 }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/#start"
            className="font-mono uppercase tracking-widest rounded-full px-4 py-2 transition-transform hover:scale-[1.03]"
            style={{ fontSize: 11, background: brand.ink, color: brand.bg }}
          >
            Start
          </Link>
          <button
            type="button"
            aria-label="menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-full"
            style={{ border: `1px solid ${brand.rule}`, color: brand.ink }}
          >
            {open ? "✕" : "≡"}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden px-5 pb-4 pt-1 flex flex-col gap-1" style={{ borderTop: `1px solid ${brand.rule}` }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-2.5"
              style={{ fontSize: 15, color: brand.ink }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
