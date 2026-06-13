"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * MobileSheet — a bottom sheet for phone-width surfaces (style editor,
 * widget picker). Full-width, slides up from the bottom, dims the page
 * behind it, and dismisses on backdrop tap, Escape, or the grab handle.
 *
 * Desktop uses anchored popovers instead; callers mount this only below
 * the `sm` breakpoint (see `useIsMobile`). Rendered inline (no portal)
 * so the space's CSS-variable theme — scoped to `.vibe-root` — still
 * applies, matching the Popover wrapper's deliberate no-portal choice.
 */
export function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  // Escape to dismiss + lock the page behind the sheet so a scroll
  // gesture doesn't move the content underneath on iOS.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.32)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[var(--v-radius)]"
            style={{
              background: "var(--v-bg)",
              borderTop: "1px solid var(--v-rule)",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
              maxHeight: "85vh",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Grab handle — tap to dismiss. */}
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="shrink-0 flex items-center justify-center pt-2.5 pb-1.5"
            >
              <span className="block rounded-full" style={{ width: 36, height: 4, background: "var(--v-rule)" }} />
            </button>
            {title && (
              <div
                className="shrink-0 px-4 pb-2 mono text-[9px] tracking-widest uppercase"
                style={{ color: "var(--v-muted)" }}
              >
                {title}
              </div>
            )}
            <div className="min-h-0 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
