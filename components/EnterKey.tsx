"use client";

import { forwardRef } from "react";
import { motion } from "motion/react";

/**
 * EnterKey — the commit button shaped like a real ISO/return key: a
 * full-width lower bar with a taller block on the upper right and a
 * notch cut from the top-left (clip-path). The label sits centred in
 * the lower bar so it reads true. A `drop-shadow` filter (which follows
 * the clipped silhouette, unlike box-shadow) gives it depth; pressing
 * nudges it down. Triggerable by mouse or the Enter key.
 */
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
      className="relative select-none disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ width: 108, height: 92, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))" }}
      initial={false}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { y: 4 }}
      transition={{ type: "spring", stiffness: 600, damping: 26 }}
    >
      {/* The key silhouette */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "#111",
          clipPath: "polygon(42% 0, 100% 0, 100% 100%, 0 100%, 0 48%, 42% 48%)",
        }}
      />
      {/* Label, centred in the lower full-width bar */}
      <span
        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2"
        style={{ height: "52%", color: "#fff" }}
      >
        <span className="text-[19px] leading-none" style={{ transform: "translateY(1px)" }} aria-hidden>↵</span>
        <span className="mono text-[10px] tracking-[0.22em] uppercase">{busy ? "···" : "enter"}</span>
      </span>
    </motion.button>
  );
});
