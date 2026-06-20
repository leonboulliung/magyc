import type { ReactNode } from "react";

/**
 * Studio shell — intentionally stripped to a bare wrapper. The account-area
 * look & feel (sidebar, header, dashboard, presets, profile, settings) is being
 * rebuilt from scratch; the pages below are placeholders for now. Auth gating
 * stays in middleware; function/data/APIs are untouched.
 */
export default function StudioShellLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-black text-white">{children}</div>;
}
