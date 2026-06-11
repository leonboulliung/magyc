"use client";

import { forwardRef } from "react";
import { motion } from "motion/react";

/**
 * EnterKey — the landing page's commit button, shaped like a physical
 * keycap. A coloured top face sits on a darker bottom edge (the 3D
 * thickness); pressing it translates the cap down and collapses that
 * edge, so it reads as a real key depressing. Triggerable by mouse or
 * by the Enter key (the parent calls the same handler).
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
      className="relative select-none rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: "#111",
        color: "#fff",
        padding: "16px 26px",
        boxShadow: "0 6px 0 #000, 0 10px 20px rgba(0,0,0,0.22)",
      }}
      initial={false}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={
        disabled
          ? undefined
          : { y: 6, boxShadow: "0 0px 0 #000, 0 3px 8px rgba(0,0,0,0.2)" }
      }
      transition={{ type: "spring", stiffness: 700, damping: 28 }}
    >
      <span className="flex items-center justify-center gap-3">
        <span
          aria-hidden
          className="inline-flex items-center justify-center text-[22px]"
          style={{ lineHeight: 1, height: "1em", transform: "translateY(1px)" }}
        >
          ⏎
        </span>
        <span className="mono text-[11px] tracking-[0.3em] uppercase leading-none">
          {busy ? "···" : "enter"}
        </span>
      </span>
    </motion.button>
  );
});
