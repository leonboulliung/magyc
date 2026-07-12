"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n/LocaleProvider";

/**
 * Shared full-screen overlay for widgets that need room to breathe
 * (Moodboard board, image lightbox). Mirrors the Sketch expand pattern:
 * portals into the `.vibe-root` (so the workspace theme variables apply),
 * locks page scroll, closes on Escape, and renders a slim header with the
 * title and a "Schließen" control. Children fill the remaining space.
 */
export function FullscreenOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tr = useT();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const target = typeof document !== "undefined"
    ? (document.querySelector(".vibe-root") ?? document.body)
    : null;
  if (!target) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "var(--v-page, var(--v-bg))" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--v-rule)" }}
      >
        <span className="mono text-[10px] tracking-widest uppercase" style={{ color: "var(--v-muted)" }}>
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full"
          style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
        >
          {tr.common.close}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>,
    target,
  );
}
