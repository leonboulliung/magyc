import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

/**
 * Suite shell — the header for the dashboard and the guided builder. The
 * project workspace (/studio/[id]) sits OUTSIDE this group so it can be a
 * full-screen SpaceView with its own fixed chrome.
 */
export default function StudioShellLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-6">
            <Link href="/studio" aria-label="MAGYC Studio" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/magyc-logo.png" alt="MAGYC" className="h-[17px] w-auto" style={{ filter: "invert(1) brightness(2)" }} />
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-white/45">Studio</span>
            </Link>
            <Link href="/studio" className="hidden font-body text-sm text-white/65 transition-colors hover:text-white sm:inline">
              Projekte
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/studio/new"
              className="rounded-full bg-white px-4 py-1.5 font-body text-sm font-medium text-black transition-all hover:bg-white/85 active:scale-[0.98]"
            >
              Neues Projekt
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
