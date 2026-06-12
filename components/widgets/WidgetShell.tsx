"use client";

import { useState } from "react";
import type { Module } from "@/lib/types";
import { useWidgetContext } from "@/lib/widgetContext";
import { Popover } from "@/components/ui/Popover";

/**
 * Shared widget shell — invisible by default, contributes the owner
 * chrome on hover:
 *   - ⇆ alternatives: a Radix popover of regenerated suggestions
 *   - ✦ prompt-edit: a Radix popover with a natural-language change box
 *   - error toast when the API rejects
 *
 * Both popovers are Radix (via our `Popover` wrapper), so they get
 * focus management, Escape + outside-click dismissal and ARIA for free —
 * the old hand-rolled panels had none. The affordance cluster stays
 * mounted (Radix needs the triggers) and just fades on hover.
 *
 * `onPick` is called when the user accepts a suggestion; the parent
 * decides whether to PUT it through directly or merge it with state.
 */
export function WidgetShell({
  module: m,
  index,
  children,
  className,
  /** When true, shows the ⇆ alternatives affordance on hover. */
  canRegenerate = true,
  /** Glyph for the alternatives affordance. ↻ reads as "reload";
   *  ⇆ reads as "swap to another option". Per-widget choice. */
  regenerateGlyph = "↻",
  /** When true, shows the ✦ prompt-edit affordance. */
  promptEditable = false,
  /** If provided, the prompt-edit bubble also offers a ✎ "edit by
   *  hand" shortcut that calls this (renderer enters inline edit). */
  onManualEdit,
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
  regenerateGlyph?: string;
  promptEditable?: boolean;
  onManualEdit?: () => void;
  renderSuggestion?: (s: Module) => React.ReactNode;
  onPick?: (s: Module) => Promise<void> | void;
}) {
  const ctx = useWidgetContext();
  const [hover, setHover] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Module[]>([]);
  const [prompt, setPrompt] = useState("");

  async function fetchSuggestions() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anonToken: ctx.ownerToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError("not loaded"); return; }
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } finally {
      setBusy(false);
    }
  }

  /** Prompt-edit: send the change request as USER GUIDANCE, apply the
   *  single returned alternative directly. */
  async function submitPrompt() {
    const guidance = prompt.trim();
    if (!guidance || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: 1, basePrompt: guidance, anonToken: ctx.ownerToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError("not applied"); return; }
      const next = Array.isArray(json.suggestions) ? json.suggestions[0] : null;
      if (!next) { setError("no result"); return; }
      await pick(next as Module);
      setBubbleOpen(false);
      setPrompt("");
    } finally {
      setBusy(false);
    }
  }

  async function pick(s: Module) {
    setAltOpen(false);
    setSuggestions([]);
    if (onPick) {
      await onPick(s);
    } else {
      await ctx.saveModule(index, s, {
        successMessage: "updated",
        undoModule: m,
      });
    }
  }

  const showAffordances = ctx.isOwner && (canRegenerate || promptEditable);
  const clusterVisible = hover || busy || altOpen || bubbleOpen;

  const affordanceStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--v-fg)" : "var(--v-bg)",
    color: active ? "var(--v-bg)" : "var(--v-fg)",
    border: "1px solid var(--v-rule)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  });

  return (
    <div
      className={`relative group ${className ?? ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}

      {showAffordances && (
        <div
          className="absolute -top-2 -right-2 z-20 flex items-center gap-1 transition-opacity duration-150"
          style={{ opacity: clusterVisible ? 1 : 0, pointerEvents: clusterVisible ? "auto" : "none" }}
        >
          {promptEditable && (
            <Popover
              open={bubbleOpen}
              onOpenChange={(o) => { setBubbleOpen(o); if (!o) setPrompt(""); }}
              side="bottom"
              align="end"
              width="min(320px, 90vw)"
              trigger={
                <button
                  type="button"
                  disabled={busy}
                  aria-label="edit with prompt"
                  title="Edit with prompt"
                  className="mono text-[11px] w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ ...affordanceStyle(bubbleOpen), color: bubbleOpen ? "var(--v-bg)" : "var(--v-accent, var(--v-fg))" }}
                >
                  ✦
                </button>
              }
            >
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <span aria-hidden style={{ color: "var(--v-accent, var(--v-fg))" }}>✦</span>
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitPrompt(); } }}
                  placeholder="…"
                  maxLength={400}
                  className="flex-1 text-[14px] bg-transparent outline-none"
                  style={{ color: "var(--v-fg)" }}
                />
                <button
                  type="button"
                  onClick={submitPrompt}
                  disabled={busy || !prompt.trim()}
                  aria-label="apply"
                  title="Apply"
                  className="mono text-[13px] opacity-60 hover:opacity-100 disabled:opacity-25"
                  style={{ color: "var(--v-fg)" }}
                >
                  {busy ? "…" : "→"}
                </button>
              </div>
              {onManualEdit && (
                <button
                  type="button"
                  onClick={() => { setBubbleOpen(false); setPrompt(""); onManualEdit(); }}
                  title="Edit manually"
                  className="w-full text-left px-3 py-2 mono text-[10px] tracking-widest opacity-50 hover:opacity-90 transition-opacity flex items-center gap-2"
                  style={{ borderTop: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                >
                  <span aria-hidden>✎</span>
                </button>
              )}
            </Popover>
          )}

          {canRegenerate && (
            <Popover
              open={altOpen}
              onOpenChange={(o) => { setAltOpen(o); if (o) fetchSuggestions(); else setSuggestions([]); }}
              side="bottom"
              align="end"
              width={280}
              noAutoFocus
              trigger={
                <button
                  type="button"
                  disabled={busy}
                  aria-label="alternatives"
                  title="Alternatives"
                  className="mono text-[11px] w-7 h-7 rounded-full flex items-center justify-center"
                  style={affordanceStyle(altOpen)}
                >
                  {busy ? "…" : regenerateGlyph}
                </button>
              }
            >
              {busy && suggestions.length === 0 && (
                <div className="px-3 py-4 mono text-[11px] tracking-widest opacity-40 text-center">…</div>
              )}
              {!busy && suggestions.length === 0 && (
                <div className="px-3 py-4 mono text-[11px] tracking-widest opacity-40 text-center">none</div>
              )}
              {suggestions.length > 0 && (
                <>
                  <ul className="divide-y" style={{ borderColor: "var(--v-rule)" }}>
                    {suggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => pick(s)}
                          className="w-full text-left px-3 py-2.5 hover:bg-black/[0.03] transition-colors flex items-start gap-3"
                        >
                          <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums shrink-0 pt-0.5">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            {renderSuggestion ? renderSuggestion(s) : (
                              <code className="mono text-[10px] opacity-70">{JSON.stringify(s).slice(0, 120)}…</code>
                            )}
                          </div>
                          <span className="mono text-[12px] opacity-50 shrink-0">↵</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="px-3 py-1.5 flex items-center justify-end" style={{ background: "var(--v-rule)" }}>
                    <button
                      type="button"
                      onClick={fetchSuggestions}
                      disabled={busy}
                      aria-label="more"
                      title="More alternatives"
                      className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100"
                    >
                      {busy ? "…" : "↻"}
                    </button>
                  </div>
                </>
              )}
            </Popover>
          )}
        </div>
      )}

      {error && (
        <span className="absolute -bottom-5 right-0 mono text-[9px] tracking-widest opacity-70">{error}</span>
      )}
    </div>
  );
}
