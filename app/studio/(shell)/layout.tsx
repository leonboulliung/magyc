import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { DotField } from "@/components/DotField";
import { StudioNav } from "@/components/studio/StudioNav";

/**
 * Studio shell — the account-area environment. A very dark matte-grey base
 * (not pure black) with the subtle dot grid + a soft top glow, so black is a
 * lit stage. A top menu bar carries the nav + account. The project workspace
 * (/studio/[id]) sits OUTSIDE this group and keeps its full-screen SpaceView.
 */
const BASE = "#0f1012";

export default function StudioShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-white" style={{ background: BASE }}>
      {/* Environment: subtle dot grid + soft glow — same language as the
          marketing hero, so the prompt field feels at home. */}
      <DotField color="255,255,255" className="pointer-events-none fixed inset-0 z-0 opacity-[0.10]" />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(circle at 50% -8%, rgba(255,255,255,0.05), transparent 40%)" }}
      />

      {/* Menu bar */}
      <header
        className="sticky top-0 z-30 border-b border-white/8 backdrop-blur-md"
        style={{ background: "rgba(15,16,18,0.8)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
            <Link href="/studio" aria-label="MAGYC" className="flex shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/magyc-logo.png" alt="MAGYC" className="h-[16px] w-auto" style={{ filter: "invert(1) brightness(2)" }} />
            </Link>
            <StudioNav />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <SignOutButton redirectUrl="/">
              <button type="button" className="font-body text-[13px] text-white/55 transition-colors hover:text-white">
                Abmelden
              </button>
            </SignOutButton>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
