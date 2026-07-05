import type { ReactNode } from "react";

/**
 * Project workspace root — the full-screen project surface lives at
 * /project/[id] (SpaceView renders its own fixed chrome). Mirrors the studio
 * root wrapper; gated by Clerk middleware.
 */
export default function ProjectRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-black text-white">{children}</div>;
}
