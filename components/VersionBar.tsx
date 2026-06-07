"use client";

import type { SpaceVersion } from "@/lib/types";

/**
 * Version bar — a thin vertical column of dashes on the left edge of a
 * published space. Each dash is one snapshot in `space_versions`. The
 * currently-viewed version is filled; older snapshots are hairlines.
 *
 * Draft spaces have no versions, so this component renders nothing.
 */
export function VersionBar({
  versions,
  currentVersion,
  onSelect,
}: {
  versions: SpaceVersion[];
  /** Which version number is currently being viewed (1-indexed). */
  currentVersion: number;
  onSelect: (version: number) => void;
}) {
  if (versions.length === 0) return null;

  return (
    <nav
      className="fixed left-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 px-3 py-4"
      aria-label="Versions"
    >
      {versions.map((v) => {
        const picked = v.version === currentVersion;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.version)}
            aria-label={`Version ${v.version}${v.note ? ` — ${v.note}` : ""}`}
            title={`v${v.version} · ${new Date(v.createdAt).toLocaleString()}`}
            className="block transition-all"
            style={{
              width: picked ? 18 : 14,
              height: 2,
              background: picked ? "var(--v-fg)" : "var(--v-muted)",
              opacity: picked ? 1 : 0.4,
              borderRadius: 1,
            }}
          />
        );
      })}
    </nav>
  );
}
