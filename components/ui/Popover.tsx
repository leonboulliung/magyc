"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";

/**
 * Popover — a thin wrapper over Radix Popover that gives us the hard
 * parts for free (focus management, Escape + outside-click dismissal,
 * ARIA wiring, collision-aware positioning) while keeping the app's
 * look (Radix is unstyled) and motion enter/exit.
 *
 * Deliberately renders WITHOUT a Portal: the space's colours live in
 * CSS variables scoped to `.vibe-root`, and portaling to <body> would
 * drop them. Inline content still gets Floating-UI positioning from
 * Radix, so it flips/shifts near edges where the old hand-rolled panels
 * just overflowed.
 *
 * Controlled (`open` / `onOpenChange`) so AnimatePresence can play the
 * exit before Radix unmounts.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  width,
  contentStyle,
  /** Keep focus on the trigger (e.g. a quick picker) instead of moving
   *  it into the panel. */
  noAutoFocus = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  width?: number | string;
  contentStyle?: React.CSSProperties;
  noAutoFocus?: boolean;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Content
            asChild
            forceMount
            side={side}
            align={align}
            sideOffset={sideOffset}
            collisionPadding={12}
            onOpenAutoFocus={noAutoFocus ? (e) => e.preventDefault() : undefined}
          >
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="rounded-md overflow-hidden"
              style={{
                zIndex: 50,
                width,
                background: "var(--v-bg)",
                border: "1px solid var(--v-rule)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                ...contentStyle,
              }}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Root>
  );
}
