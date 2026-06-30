"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/** A single restrained route transition shared by every Studio section. */
export default function StudioTemplate({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
