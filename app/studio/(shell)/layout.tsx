import type { ReactNode } from "react";
import Link from "next/link";
import { DotField } from "@/components/DotField";
import { StudioNav } from "@/components/studio/StudioNav";
import { StudioAccountControls } from "@/components/studio/StudioAccountControls";
import { SupportWidget } from "@/components/support/SupportWidget";

/**
 * Studio shell — the account-area environment. A light, warm off-white base
 * (the "tool" surface) with a faint dot grid + soft top tint. A top menu bar
 * carries the nav + account. The project workspace (/studio/[id]) sits OUTSIDE
 * this group and keeps its dark full-screen SpaceView (the "stage").
 */
const BASE = "#f4f4f1";

export default function StudioShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-[#17171a]" style={{ background: BASE }}>
      {/* Environment: faint dot grid + soft tint, the light counterpart of the
          marketing hero, so the prompt field feels at home. */}
      <DotField color="0,0,0" className="pointer-events-none fixed inset-0 z-0 opacity-[0.05]" />

      {/* Menu bar */}
      <header
        className="sticky top-0 z-30 border-b border-black/10 backdrop-blur-md"
        style={{ background: "rgba(244,244,241,0.82)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
            <Link href="/studio" aria-label="MAGYC" className="flex shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/magyc-logo.png" alt="MAGYC" className="h-[18px] w-auto" />
            </Link>
            <StudioNav />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SupportWidget variant="studio" />
            <StudioAccountControls />
          </div>
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
