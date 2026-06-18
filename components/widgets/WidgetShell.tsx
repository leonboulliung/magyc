"use client";

import { useState } from "react";
import type { Module } from "@/lib/types";
import { useWidgetContext } from "@/lib/widgetContext";
import { Popover } from "@/components/ui/Popover";
import { readApiJson, showApiError, showUnknownError } from "@/lib/client/feedback";
import { useCellChrome } from "./cellChrome";

/** A clear prompt placeholder in the space's language, so it's obvious
 *  the box rewrites this widget from a plain-language instruction. */
const PROMPT_PLACEHOLDER: Record<string, string> = {
  en: "Describe how to change this…",
  de: "Wie soll das geändert werden?",
  fr: "Comment modifier ceci ?",
  es: "¿Cómo cambiar esto?",
  it: "Come modificare questo?",
  pt: "Como alterar isto?",
  nl: "Hoe dit aanpassen?",
};
function promptPlaceholder(lang: string): string {
  return PROMPT_PLACEHOLDER[(lang || "en").toLowerCase().split("-")[0]] ?? PROMPT_PLACEHOLDER.en!;
}

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
  const cell = useCellChrome();
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
      const json = await readApiJson(res);
      if (!res.ok) {
        const message = showApiError("Alternativen nicht geladen", json, {
          fallback: "Für dieses Element konnten gerade keine Alternativen geladen werden.",
        });
        setError(message);
        return;
      }
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } catch (error) {
      const message = showUnknownError("Alternativen nicht geladen", error, {
        fallback: "Für dieses Element konnten gerade keine Alternativen geladen werden.",
      });
      setError(message);
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
      const json = await readApiJson(res);
      if (!res.ok) {
        const message = showApiError("Änderung nicht angewendet", json, {
          fallback: "Die Prompt-Änderung konnte gerade nicht angewendet werden.",
        });
        setError(message);
        return;
      }
      const next = Array.isArray(json.suggestions) ? json.suggestions[0] : null;
      if (!next) {
        const message = "MAGYC hat keine passende Variante zurückgegeben.";
        setError(message);
        showUnknownError("Änderung nicht angewendet", new Error(message));
        return;
      }
      await pick(next as Module);
      setBubbleOpen(false);
      setPrompt("");
    } catch (error) {
      const message = showUnknownError("Änderung nicht angewendet", error, {
        fallback: "Die Prompt-Änderung konnte gerade nicht angewendet werden.",
      });
      setError(message);
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

  // One toolbar for the whole element: cell chrome (reorder / resize /
  // remove, if this widget sits in a grid cell) + its own affordances
  // (prompt-edit, alternatives).
  const showBar = ctx.isOwner && (!!cell || canRegenerate || promptEditable);
  const clusterVisible = hover || busy || altOpen || bubbleOpen;

  const barBtn = "w-7 h-7 flex items-center justify-center hover:bg-white/[0.08] transition-colors disabled:opacity-30";

  return (
    <div
      className={`relative group ${className ?? ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}

      {showBar && (
        <div
          className="absolute top-2 right-2 z-20 flex items-center overflow-hidden transition-opacity duration-150"
          style={{
            opacity: clusterVisible ? 1 : 0,
            pointerEvents: clusterVisible ? "auto" : "none",
            background: "rgba(255,255,255,0.055)",
            border: "1px solid var(--v-rule)",
            borderRadius: 999,
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 10px 28px rgba(0,0,0,0.22)",
            backdropFilter: "blur(18px)",
          }}
        >
          {cell && (
            <>
              <button
                type="button"
                ref={cell.setActivatorNodeRef}
                {...cell.attributes}
                {...cell.listeners}
                aria-label="reorder"
                title="drag to reorder"
                className={`${barBtn} text-[13px] select-none`}
                style={{ cursor: "grab", touchAction: "none", color: "var(--v-muted)" }}
              >
                ⠿
              </button>
              <button
                type="button"
                onClick={cell.onToggleFull}
                title={cell.isFull ? "half width" : "full width"}
                className={`${barBtn} text-[13px] hidden sm:flex`}
                style={{ color: "var(--v-muted)" }}
              >
                {cell.isFull ? "⇥" : "⇔"}
              </button>
              <button
                type="button"
                onClick={cell.onRemove}
                disabled={cell.busy}
                title="remove"
                className={`${barBtn} text-[15px]`}
                style={{ color: "var(--v-muted)" }}
              >
                ×
              </button>
            </>
          )}
          {cell && (promptEditable || canRegenerate) && (
            <span aria-hidden className="self-stretch w-px my-1.5 mx-0.5" style={{ background: "var(--v-rule)" }} />
          )}
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
                  className={`${barBtn} text-[13px]`}
                  style={{ background: bubbleOpen ? "var(--v-fg)" : "transparent", color: bubbleOpen ? "var(--v-bg)" : "var(--v-accent, var(--v-fg))" }}
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
                  placeholder={promptPlaceholder(ctx.language)}
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
                  className={`${barBtn} text-[13px]`}
                  style={{ background: altOpen ? "var(--v-fg)" : "transparent", color: altOpen ? "var(--v-bg)" : "var(--v-muted)" }}
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
                          className="w-full text-left px-3 py-2.5 hover:bg-white/[0.06] transition-colors flex items-start gap-3"
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
