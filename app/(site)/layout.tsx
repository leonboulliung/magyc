import type { ReactNode } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { brand } from "@/lib/site";

/**
 * Shared chrome for every marketing page (everything under the (site)
 * route group). The landing at `/` is handled separately because it also
 * hosts the live prompt tool. Fixed brand look — not per-space themed.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: brand.bg, color: brand.ink, minHeight: "100vh" }}>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
