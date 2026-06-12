"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";

/**
 * Dialog — a thin wrapper over Radix Dialog: a dimmed, focus-trapped,
 * Escape/outside-click-dismissible centered modal with Motion enter/exit.
 *
 * Unlike our Popover this DOES portal to <body> — modals must sit above
 * everything. Use it only for content that doesn't depend on the space's
 * `.vibe-root` CSS variables (e.g. the neutral publish dialog).
 *
 * The panel (Content) is the animated element, centered by a
 * pointer-events-none flex layer so clicks on the backdrop still reach
 * the Overlay and dismiss.
 */
export function Dialog({
  open,
  onOpenChange,
  children,
  maxWidth = 448,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  maxWidth?: number;
  /** Accessible title — visually hidden if your content has its own. */
  title?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[60]"
                style={{ background: "rgba(0,0,0,0.5)" }}
              />
            </DialogPrimitive.Overlay>

            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
              <DialogPrimitive.Content asChild forceMount aria-label={title}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-auto w-full"
                  style={{ maxWidth }}
                >
                  {title && <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>}
                  {children}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
