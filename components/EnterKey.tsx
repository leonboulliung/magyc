"use client";

import { forwardRef } from "react";
import { motion } from "motion/react";

/**
 * EnterKey — the commit button shaped like a real ISO/return key.
 *
 * Drawn as an SVG path so every corner — including the CONCAVE notch
 * corner (top-left) — is rounded to the same radius the Thing-page
 * widget cards use. That concave corner is what lets the key dock
 * cleanly against the input card's bottom-right corner (the card's
 * convex corner nestles into the notch, with a little air). The label
 * is centred in the lower full-width bar; a shape-following drop-shadow
 * gives depth; pressing nudges it down.
 */
const W = 104;
const H = 88;
const NX = 44; // notch width
const NY = 42; // notch height
const R = 20;   // corner radius — matches Thing-page widgets

// Rounded ISO-enter outline: notch top-left, every corner radiused R
// (the notch's inner corner is concave → opposite arc sweep).
const PATH = [
  `M ${NX + R} 0`,
  `L ${W - R} 0`,
  `A ${R} ${R} 0 0 1 ${W} ${R}`,
  `L ${W} ${H - R}`,
  `A ${R} ${R} 0 0 1 ${W - R} ${H}`,
  `L ${R} ${H}`,
  `A ${R} ${R} 0 0 1 0 ${H - R}`,
  `L 0 ${NY + R}`,
  `A ${R} ${R} 0 0 1 ${R} ${NY}`,
  `L ${NX - R} ${NY}`,
  `A ${R} ${R} 0 0 0 ${NX} ${NY - R}`,
  `L ${NX} ${R}`,
  `A ${R} ${R} 0 0 1 ${NX + R} 0`,
  "Z",
].join(" ");

export const EnterKey = forwardRef<
  HTMLButtonElement,
  { onPress: () => void; disabled?: boolean; busy?: boolean }
>(function EnterKey({ onPress, disabled, busy }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label="continue (Enter)"
      className="relative block select-none disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ width: W, height: H, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))" }}
      initial={false}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { y: 4 }}
      transition={{ type: "spring", stiffness: 600, damping: 26 }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="absolute inset-0"
        aria-hidden
      >
        <path d={PATH} fill="#111" />
      </svg>
      {/* Label, centred in the lower full-width bar (y: NY → H). */}
      <span
        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2"
        style={{ height: H - NY, color: "#fff" }}
      >
        <span className="text-[19px] leading-none" style={{ transform: "translateY(1px)" }} aria-hidden>↵</span>
        <span className="mono text-[10px] tracking-[0.22em] uppercase">{busy ? "···" : "enter"}</span>
      </span>
    </motion.button>
  );
});
