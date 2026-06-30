import type { ReactNode } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { DotField } from "@/components/DotField";
import { brand } from "@/lib/site";

/**
 * Shared chrome for every marketing page (everything under the (site)
 * route group). The landing at `/` is handled separately because it also
 * hosts the live prompt tool. Fixed brand look — not per-space themed.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip" style={{ background: brand.bg, color: brand.ink }}>
      <DotField color="0,0,0" className="pointer-events-none fixed inset-0 z-0 opacity-[0.045]" />
      <SiteNav />
      <main className="relative z-10 flex-1">{children}</main>
      <div className="relative z-10 shrink-0"><SiteFooter /></div>
    </div>
  );
}
