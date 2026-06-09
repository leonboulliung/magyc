"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Module } from "@/lib/types";
import { useWidgetContext } from "@/lib/widgetContext";

/**
 * Shared widget shell — invisible by default, contributes:
 *   - hover-reveal of edit affordances (only when owner)
 *   - regenerate flow: ↻ button → loading → suggestions popover
 *   - save flow: shipping a sanitised widget to the PUT endpoint
 *   - error toast when the API rejects
 *
 * The actual rendering of the widget content is the child's job. The
 * shell only adds the chrome.
 *
 * `onPick` is called when the user accepts a regenerate suggestion;
 * the parent decides whether to PUT it through directly (most cases)
 * or merge it with current state (some).
 */
export function WidgetShell({
  module: m,
  index,
  children,
  className,
  /** When true, shows the ↻ regenerate affordance on hover. */
  canRegenerate = true,
  /** Render a preview row for a suggestion in the popover. */
  renderSuggestion,
  /** Called when the user picks a suggestion. Default: PUT it through
   *  as a full widget replacement. */
  onPick,
}: {
  module: Module;
  index: number;
  children: React.ReactNode;
  className?: string;
  canRegenerate?: boolean;
  renderSuggestion?: (s: Module) => React.ReactNode;
  onPick?: (s: Module) => Promise<void> | void;
}) {
  const ctx = useWidgetContext();
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Module[]>([]);

  async function fetchSuggestions() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/spaces/${ctx.spaceId}/widgets/${index}/regenerate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ anonToken: ctx.ownerToken }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("✕");
        return;
      }
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function pick(s: Module) {
    if (onPick) {
      await onPick(s);
    } else {
      // Default: replace via PUT.
      await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          widget: s,
          anonOwnerToken: ctx.ownerToken,
        }),
      });
    }
    setOpen(false);
    setSuggestions([]);
    ctx.refresh();
  }

  return (
    <div
      className={`relative group ${className ?? ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}

      {/* Regenerate affordance — only when owner, hovered, and a
          handler is wanted. Sits at top-right, doesn't disturb the
          widget surface. */}
      {ctx.isOwner && canRegenerate && (
        <AnimatePresence>
          {(hover || busy || open) && (
            <motion.button
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.15 }}
              onClick={fetchSuggestions}
              disabled={busy}
              aria-label="regenerate"
              className="absolute -top-2 -right-2 mono text-[11px] w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: "var(--v-bg)",
                color: "var(--v-fg)",
                border: "1px solid var(--v-rule)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {busy ? "…" : "↻"}
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Suggestions popover */}
      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-full mt-2 z-40 rounded-md overflow-hidden"
            style={{
              background: "var(--v-bg)",
              border: "1px solid var(--v-rule)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <ul className="divide-y" style={{ borderColor: "var(--v-rule)" }}>
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    onClick={() => pick(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-black/[0.03] transition-colors flex items-start gap-3"
                  >
                    <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums shrink-0 pt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      {renderSuggestion ? renderSuggestion(s) : (
                        <code className="mono text-[10px] opacity-70">
                          {JSON.stringify(s).slice(0, 120)}…
                        </code>
                      )}
                    </div>
                    <span className="mono text-[12px] opacity-50 shrink-0">↵</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: "var(--v-rule)", opacity: 0.6 }}>
              <button
                onClick={fetchSuggestions}
                disabled={busy}
                className="mono text-[10px] tracking-widest"
              >
                {busy ? "…" : "↻"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="mono text-[10px] tracking-widest"
                aria-label="close"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <span className="absolute -bottom-5 right-0 mono text-[9px] tracking-widest opacity-70">
          {error}
        </span>
      )}
    </div>
  );
}
