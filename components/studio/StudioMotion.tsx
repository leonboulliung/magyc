"use client";

import { motion } from "motion/react";
import { studioItem, studioPage, studioRow, studioStagger } from "@/lib/anim";

export function StudioPageMotion({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={studioPage}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StudioStaggerMotion({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="show" variants={studioStagger} className={className}>
      {children}
    </motion.div>
  );
}

export function StudioItemMotion({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={studioItem} className={className}>
      {children}
    </motion.div>
  );
}

export function StudioTableRowMotion({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.tr variants={studioRow} className={className}>
      {children}
    </motion.tr>
  );
}

export function StudioTableBodyMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.tbody initial="hidden" animate="show" variants={studioStagger}>
      {children}
    </motion.tbody>
  );
}
