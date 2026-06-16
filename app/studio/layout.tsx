import type { ReactNode } from "react";

/**
 * Studio root — minimal wrapper for the whole account-first Creator Suite
 * (gated by Clerk middleware). The shared header lives in the (shell) group
 * so the full-screen project workspace at /studio/[id] can opt out of it
 * (SpaceView renders its own fixed chrome).
 */
export default function StudioRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-black text-white">{children}</div>;
}
