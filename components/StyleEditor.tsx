"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { SpaceStyle } from "@/lib/types";
import { FONT_CATALOG } from "@/lib/fonts";

/**
 * StyleEditor — owner-only popover to edit a space's visual style:
 * font (Google Fonts) + three colors. Changes preview live (via
 * onPreview, which re-paints the CSS vars + loads the font) and persist
 * with a short debounce.
 */
const CATEGORY_LABEL: Record<string, string> = {
  sans: "Sans", serif: "Serif", mono: "Mono", display: "Display", hand: "Hand",
};

export function StyleEditor({
  style,
  spaceId,
  ownerToken,
  onPreview,
  onSaved,
}: {
  style: SpaceStyle;
  spaceId: string;
  ownerToken: string | null;
  /** Called on every change for instant live preview. */
  onPreview: (style: SpaceStyle) => void;
  /** Called after a successful persist. */
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SpaceStyle>(style);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<SpaceStyle>(style);
  const lastSavedRef = useRef<SpaceStyle>(style);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setDraft(style);
    draftRef.current = style;
    lastSavedRef.current = style;
    setStatus("idle");
  }, [style]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const persist = useCallback(async (next: SpaceStyle, immediate = false) => {
    setStatus("saving");
    try {
      const res = await fetch(`/api/spaces/${spaceId}/style`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style: next, anonOwnerToken: ownerToken }),
        keepalive: immediate,
      });
      if (!res.ok) {
        setStatus("error");
        onPreview(lastSavedRef.current);
        setDraft(lastSavedRef.current);
        draftRef.current = lastSavedRef.current;
        return false;
      }
      lastSavedRef.current = next;
      setStatus("saved");
      onSaved?.();
      return true;
    } catch {
      setStatus("error");
      onPreview(lastSavedRef.current);
      setDraft(lastSavedRef.current);
      draftRef.current = lastSavedRef.current;
      return false;
    }
  }, [onPreview, onSaved, ownerToken, spaceId]);

  const flushPending = useCallback((immediate = false) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void persist(draftRef.current, immediate);
    }
  }, [persist]);

  useEffect(() => () => {
    flushPending(true);
  }, [flushPending]);

  function update(patch: Partial<SpaceStyle>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    draftRef.current = next;
    onPreview(next); // instant
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(next);
    }, 350);
  }

  // Group fonts by category for the dropdown.
  const grouped = FONT_CATALOG.reduce<Record<string, typeof FONT_CATALOG>>((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) flushPending(true);
          setOpen((v) => !v);
        }}
        aria-label="style"
        title="style"
        className="mono text-[11px] w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: "var(--v-bg)",
          color: "var(--v-fg)",
          border: `1px solid ${open ? "var(--v-fg)" : "var(--v-rule)"}`,
        }}
      >
        ◐
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { flushPending(true); setOpen(false); }} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="fixed left-3 right-3 top-4 z-50 rounded-[var(--v-radius)] p-4 space-y-4 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2"
              style={{
                width: isMobile ? undefined : 260,
                maxHeight: "calc(100vh - 2rem)",
                overflowY: "auto",
                background: "var(--v-bg)",
                border: "1px solid var(--v-rule)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
              }}
            >
              {/* Font */}
              <div className="space-y-1.5">
                <div className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--v-muted)" }}>
                  font
                </div>
                <select
                  value={draft.font}
                  onChange={(e) => update({ font: e.target.value })}
                  className="w-full text-[12px] px-2 py-1.5 rounded-[var(--v-radius)] bg-transparent outline-none"
                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                >
                  {Object.entries(grouped).map(([cat, fonts]) => (
                    <optgroup key={cat} label={CATEGORY_LABEL[cat] ?? cat}>
                      {fonts.map((f) => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Colors */}
              <div className="space-y-2.5">
                <ColorRow label="ink" hint="text · borders · pins" value={draft.color1} onChange={(c) => update({ color1: c })} />
                <ColorRow label="accent" hint="widgets · maps" value={draft.color2} onChange={(c) => update({ color2: c })} />
                <ColorRow label="canvas" hint="page background" value={draft.background} onChange={(c) => update({ background: c })} />
              </div>

              <div className="mono text-[9px] tracking-widest opacity-55" style={{ color: "var(--v-muted)" }}>
                {status === "saving" ? "saving…" : status === "saved" ? "saved" : status === "error" ? "not saved" : ""}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <label className="relative shrink-0" style={{ width: 28, height: 28 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <span
          className="block rounded-full"
          style={{ width: 28, height: 28, background: value, border: "1px solid var(--v-rule)" }}
        />
      </label>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] leading-none" style={{ color: "var(--v-fg)" }}>{label}</div>
        <div className="mono text-[9px] tracking-wide mt-0.5" style={{ color: "var(--v-muted)" }}>{hint}</div>
      </div>
      <input
        value={value}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#([0-9a-fA-F]{6})$/.test(v)) onChange(v);
        }}
        maxLength={7}
        className="mono text-[10px] w-[72px] shrink-0 px-1.5 py-1 rounded-[var(--v-radius)] bg-transparent outline-none text-right"
        style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
      />
    </div>
  );
}
