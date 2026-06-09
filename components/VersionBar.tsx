"use client";

import { motion } from "motion/react";
import type { SpaceVersion } from "@/lib/types";
import { versionBarContainer, versionBarItem } from "@/lib/anim";

/**
 * Version bar — thin vertical column of dashes on the right edge of a
 * published space. Each dash is one snapshot. Staggered entrance via
 * versionBarItem so the dashes appear one after another on load.
 */
export function VersionBar({
  versions,
  currentVersion,
  onSelect,
}: {
  versions: SpaceVersion[];
  currentVersion: number;
  onSelect: (version: number) => void;
}) {
  if (versions.length === 0) return null;

  return (
    <motion.nav
      className="flex flex-col items-center gap-3 px-2 py-3"
      aria-label="Versions"
      variants={versionBarContainer}
      initial="hidden"
      animate="show"
    >
      {versions.map((v) => {
        const picked = v.version === currentVersion;
        return (
          <motion.button
            key={v.id}
            onClick={() => onSelect(v.version)}
            aria-label={`Version ${v.version}${v.note ? ` — ${v.note}` : ""}`}
            title={`v${v.version} · ${new Date(v.createdAt).toLocaleString()}`}
            variants={versionBarItem}
            whileHover={{ scaleX: 2.5, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            style={{
              display: "block",
              width: 2,
              height: picked ? 18 : 14,
              background: picked ? "var(--v-fg)" : "var(--v-muted)",
              opacity: picked ? 1 : 0.4,
              borderRadius: 1,
              originX: "50%",
            }}
          />
        );
      })}
    </motion.nav>
  );
}
