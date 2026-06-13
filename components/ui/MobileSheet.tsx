"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";

/**
 * MobileSheet — a bottom sheet for phone-width surfaces (style editor,
 * widget picker). Full-width, slides up from the bottom, dims the page
 * behind it, and dismisses on backdrop tap, Escape, or the grab handle.
 *
 * Desktop uses anchored popovers instead; callers mount this only below
 * the `sm` breakpoint (see `useIsMobile`).
 *
 * Portaled into `.vibe-root` rather than rendered inline: `position:
 * fixed` resolves against the nearest ancestor that has a `transform`
 * (or `will-change: transform`), and the sheet's callers sit inside
 * transformed ancestors — the scroll-hiding top toolbar, the motion /
 * dnd-kit wrappers in the grid — which would otherwise anchor the
 * "fixed" sheet to that small box instead of the viewport. `.vibe-root`
 * is the un-transformed themed root, so the portal both escapes those
 * containing blocks and keeps the space's CSS-variable theme.
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
  // Resolve the portal target on the client (the themed, un-transformed
  // root). Falls back to <body> if the root isn't found (e.g. showroom).
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    setTarget(document.querySelector(".vibe-root") ?? document.body);
  }, []);

  // Drag-to-dismiss. Drag is started only from the grab handle (via
  // dragControls + dragListener={false}) so a scroll gesture inside the
  // sheet body never gets hijacked.
  const dragControls = useDragControls();

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

  if (!target) return null;

  return createPortal(
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
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose();
            }}
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
            {/* Grab handle — drag down or tap to dismiss. */}
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(e) => dragControls.start(e)}
              aria-label="close"
              className="shrink-0 flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              style={{ touchAction: "none" }}
            >
              <span className="block rounded-full" style={{ width: 40, height: 5, background: "var(--v-rule)" }} />
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
    </AnimatePresence>,
    target,
  );
}
