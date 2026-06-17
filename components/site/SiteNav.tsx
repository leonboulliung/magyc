"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { MAIN_NAV, USE_CASES, isNavGroup } from "@/lib/site";

/**
 * SiteNav — the marketing-site top bar. White serif wordmark top-left;
 * nav + CTA on the right. Desktop shows the "Anwendungsfälle" dropdown on
 * hover; on mobile everything collapses into a burger panel so every page
 * (incl. the segment submenu) stays reachable. Reads like a tool, not an
 * art piece. The logo PNG is black-on-transparent; `invert` renders white.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [signInTarget, setSignInTarget] = useState("/studio");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setSignInTarget(next);
    }
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" aria-label="MAGYC" className="flex items-center" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/magyc-logo.png"
            alt="MAGYC"
            className="h-[18px] w-auto sm:h-[20px]"
            style={{ filter: "invert(1) brightness(2)" }}
          />
        </Link>

        {/* ── Desktop nav ─────────────────────────────────────── */}
        <nav className="hidden items-center gap-7 md:flex">
          {MAIN_NAV.map((entry) =>
            isNavGroup(entry) ? (
              <div key={entry.label} className="group relative">
                <button type="button" className="flex items-center gap-1 font-body text-sm text-white/65 transition-colors duration-200 hover:text-white">
                  {entry.label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="mt-px opacity-70">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {/* hover bridge + menu */}
                <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <div className="min-w-[200px] rounded-2xl border border-white/12 bg-black/90 p-2 backdrop-blur-md">
                    {entry.items.map((it) => (
                      <Link key={it.href} href={it.href} className="block rounded-xl px-3 py-2 font-body text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white">
                        {it.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={entry.href} href={entry.href} className="font-body text-sm text-white/65 transition-colors duration-200 hover:text-white">
                {entry.label}
              </Link>
            ),
          )}
          <SignedOut>
            <SignInButton
              mode="modal"
              forceRedirectUrl={signInTarget}
              fallbackRedirectUrl={signInTarget}
              signUpForceRedirectUrl={signInTarget}
              signUpFallbackRedirectUrl={signInTarget}
            >
              <button type="button" className="font-body text-sm text-white/65 transition-colors duration-200 hover:text-white">
                Anmelden
              </button>
            </SignInButton>
            <Link href="/#start" className="rounded-full bg-white px-4 py-1.5 font-body text-sm font-medium text-black transition-all duration-200 hover:bg-white/85 active:scale-[0.98]">
              Kostenlos testen
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/studio" className="font-body text-sm text-white/65 transition-colors duration-200 hover:text-white">
              Studio
            </Link>
            <Link href="/studio/new" className="rounded-full bg-white px-4 py-1.5 font-body text-sm font-medium text-black transition-all duration-200 hover:bg-white/85 active:scale-[0.98]">
              Neues Projekt
            </Link>
          </SignedIn>
        </nav>

        {/* ── Mobile burger ───────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center text-white md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </div>

      {/* ── Mobile panel ──────────────────────────────────────── */}
      {open && (
        <div className="md:hidden">
          <div className="mx-4 mt-1 rounded-2xl border border-white/12 bg-black/95 p-5 backdrop-blur-md">
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">Anwendungsfälle</p>
            <div className="mb-4 grid grid-cols-2 gap-1">
              {USE_CASES.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 font-body text-[15px] text-white/80 hover:bg-white/10 hover:text-white">
                  {it.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-1 border-t border-white/10 pt-4">
              {MAIN_NAV.filter((e) => !isNavGroup(e)).map((e) => {
                const link = e as { href: string; label: string };
                return (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 font-body text-[15px] text-white/80 hover:bg-white/10 hover:text-white">
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
              <SignedOut>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={signInTarget}
                  fallbackRedirectUrl={signInTarget}
                  signUpForceRedirectUrl={signInTarget}
                  signUpFallbackRedirectUrl={signInTarget}
                >
                  <button type="button" className="font-body text-[15px] text-white/70 hover:text-white">Anmelden</button>
                </SignInButton>
                <Link href="/#start" onClick={() => setOpen(false)} className="ml-auto rounded-full bg-white px-4 py-2 font-body text-sm font-medium text-black">
                  Kostenlos testen
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/studio" onClick={() => setOpen(false)} className="font-body text-[15px] text-white/70 hover:text-white">
                  Studio
                </Link>
                <Link href="/studio/new" onClick={() => setOpen(false)} className="ml-auto rounded-full bg-white px-4 py-2 font-body text-sm font-medium text-black">
                  Neues Projekt
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
