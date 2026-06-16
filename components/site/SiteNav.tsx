"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { NAV_LINKS } from "@/lib/site";

/**
 * SiteNav — the marketing-site top bar. A clean, full-width bar: the white
 * serif wordmark sits top-left, the links + CTA sit right. No floating
 * pill, no decoration — it should read like a real product, not an art
 * piece. The logo PNG is black-on-transparent; `invert` renders it white.
 */
export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" aria-label="MAGYC" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/magyc-logo.png"
            alt="MAGYC"
            className="h-[18px] w-auto sm:h-[20px]"
            style={{ filter: "invert(1) brightness(2)" }}
          />
        </Link>

        <nav className="flex items-center gap-5 sm:gap-7">
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-body text-sm text-white/65 transition-colors duration-200 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <SignInButton mode="modal">
            <button
              type="button"
              className="hidden font-body text-sm text-white/65 transition-colors duration-200 hover:text-white sm:inline"
            >
              Anmelden
            </button>
          </SignInButton>

          <Link
            href="/#start"
            className="rounded-full bg-white px-4 py-1.5 font-body text-sm font-medium text-black transition-all duration-200 hover:bg-white/85 active:scale-[0.98]"
          >
            Kostenlos testen
          </Link>
        </nav>
      </div>
    </header>
  );
}
