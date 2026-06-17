import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { StudioSidebar } from "@/components/studio/StudioSidebar";

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
            <Link href="/studio" aria-label="MAGYC" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/magyc-logo.png" alt="MAGYC" className="h-[17px] w-auto" style={{ filter: "invert(1) brightness(2)" }} />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="font-body text-sm text-white/65 transition-colors hover:text-white"
              >
                Abmelden
              </button>
            </SignOutButton>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <div className="sm:grid sm:grid-cols-[176px_1fr]">
        <StudioSidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
