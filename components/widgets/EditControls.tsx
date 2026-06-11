"use client";

import { motion } from "motion/react";

/**
 * Shared inline-edit commit controls — a floating ✓ save / × cancel
 * pair shown while a text surface is in manual-edit mode.
 *
 * Both buttons use onMouseDown + preventDefault so the underlying
 * textarea/input does NOT blur before the click handler runs. This
 * lets renderers keep onBlur={save} as a click-away safety net while
 * still routing × cancel correctly (blur would otherwise save first
 * and defeat the cancel).
 *
 * Symbol-only, per the app's no-platform-language rule.
 */
export function EditControls({
  onSave,
  onCancel,
  className,
}: {
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      className={`flex items-center gap-1.5 mt-1 ${className ?? ""}`}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCancel}
        aria-label="cancel"
        className="mono text-[12px] w-6 h-6 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
        style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)", background: "var(--v-bg)" }}
      >
        ×
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSave}
        aria-label="save"
        className="mono text-[12px] w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: "var(--v-fg)", color: "var(--v-bg)", border: "1px solid var(--v-fg)" }}
      >
        ✓
      </button>
    </motion.div>
  );
}
