import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { DotField } from "@/components/DotField";
import { StudioNav } from "@/components/studio/StudioNav";
import { StudioAccountControls } from "@/components/studio/StudioAccountControls";
import { StudioThemeSync } from "@/components/studio/StudioThemeSync";
import { SupportWidget } from "@/components/support/SupportWidget";
import { fetchProjectTheme } from "@/lib/server/profile";

/**
 * Studio shell — the account-area environment. A light, warm off-white base
 * (the "tool" surface) with a faint dot grid + soft top tint. A top menu bar
 * carries the nav + account. The project workspace (/studio/[id]) sits OUTSIDE
 * this group and uses the same selected application theme at full-screen scale.
 */
export default async function StudioShellLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  const theme = await fetchProjectTheme(userId);
  const dark = theme === "dark";
  return (
    <div
      className="studio-theme relative min-h-screen"
      data-theme={theme}
      style={{ background: dark ? "#050505" : "#f4f4f1", color: dark ? "#f4f4f1" : "#17171a" }}
    >
      <StudioThemeSync theme={theme} />
      {/* Environment: faint dot grid + soft tint, the light counterpart of the
          marketing hero, so the prompt field feels at home. */}
      <DotField color={dark ? "255,255,255" : "0,0,0"} className="pointer-events-none fixed inset-0 z-0 opacity-[0.05]" />

      {/* Menu bar */}
      <header
        className="studio-header sticky top-0 z-30 border-b backdrop-blur-xl"
        style={{
          background: dark ? "rgba(5,5,5,0.94)" : "rgba(244,244,241,0.94)",
          borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
            <Link href="/studio" aria-label="MAGYC" className="flex shrink-0 items-center">
              <Image src="/magyc-logo.png" alt="MAGYC" width={182} height={40} className="theme-logo h-[18px] w-auto" priority />
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
