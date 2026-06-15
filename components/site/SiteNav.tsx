"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { NAV_LINKS } from "@/lib/site";

/**
 * SiteNav — the marketing-site top bar. Sticky, translucent, with the
 * serif wordmark, primary links, and a "Start" CTA into the tool. On
 * phones the links collapse into a simple toggled sheet.
 */
export function SiteNav() {
  return (
    <header className="fixed left-1/2 top-5 z-50 -translate-x-1/2 whitespace-nowrap px-3">
      <nav className="liquid-glass flex items-center gap-3 rounded px-3 py-2.5 sm:gap-6 sm:px-4">
        <div className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-body text-sm font-light text-white/70 transition-colors duration-200 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-1 flex items-center gap-3 sm:ml-4">
          <SignInButton mode="modal">
            <button
              type="button"
              className="hidden font-body text-sm font-light text-white/70 transition-colors duration-200 hover:text-white sm:inline"
            >
              Sign in
            </button>
          </SignInButton>
          <Link
            href="/#start"
            className="liquid-glass-strong rounded px-4 py-1.5 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.04] hover:shadow-[0_0_16px_2px_rgba(255,255,255,0.12)] active:scale-[0.97]"
          >
            Try it free
          </Link>
        </div>
      </nav>
    </header>
  );
}
