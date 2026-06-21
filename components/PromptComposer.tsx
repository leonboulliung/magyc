"use client";

import { forwardRef, useState, type ReactNode } from "react";

/**
 * Shared prompt field — the single source of truth for the "describe your
 * project" box used both on the marketing homepage and inside the Studio, so
 * the two surfaces look identical.
 *
 * Redesign: a soft colour gradient ring around a near-black field that blooms
 * on focus — colour enters at the edge + the send button (the action), calm at
 * rest. The page supplies its context via `topSlot` / `chips` / `footer`.
 */

const RING_REST = "linear-gradient(120deg, rgba(139,123,255,0.40), rgba(74,168,255,0.30), rgba(57,210,180,0.38))";
const RING_FOCUS = "linear-gradient(120deg, #8b7bff, #4aa8ff, #39d2b4)";
const SEND_BG = "linear-gradient(135deg, #8b7bff, #39d2b4)";

export const PromptComposer = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (value: string) => void;
  /** Enter (without Shift/⌘/Ctrl) submits when provided. */
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  /** Above the textarea — mode chips / preset picker. */
  topSlot?: ReactNode;
  /** Below the textarea — example or fast-prompt chips. */
  chips?: ReactNode;
  /** Bottom of the card — hint / submit affordance. */
  footer?: ReactNode;
  /** Pulse glow (e.g. an empty-submit nudge). */
  highlight?: boolean;
  id?: string;
  className?: string;
}>(function PromptComposer(
  { value, onChange, onSubmit, placeholder, disabled, maxLength = 1200, rows = 3, autoFocus, topSlot, chips, footer, highlight, id, className },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const lit = focused || highlight;

  return (
    <div
      id={id}
      className={`w-full rounded-[30px] p-px transition-all duration-300 sm:rounded-[32px] ${className ?? ""}`}
      style={{
        background: lit ? RING_FOCUS : RING_REST,
        boxShadow: lit
          ? "0 0 44px rgba(74,168,255,0.20), 0 18px 60px rgba(0,0,0,0.34)"
          : "0 18px 60px rgba(0,0,0,0.30)",
      }}
    >
      <div
        className="rounded-[29px] p-5 sm:rounded-[31px] sm:p-6"
        style={{ background: "#0b0c0e", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06)" }}
      >
        {topSlot && <div className="mb-4">{topSlot}</div>}

        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(e) => {
            if (onSubmit && e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="w-full resize-none border-0 bg-transparent text-[18px] leading-relaxed text-white outline-none placeholder:text-white/32 sm:text-[21px]"
        />

        {(chips || value.length > 0 || onSubmit) && (
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">{chips}</div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="mono text-[10px] tracking-widest tabular-nums opacity-40">
                {value.length > 0 ? `${value.length}/${maxLength}` : ""}
              </span>
              {onSubmit && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={disabled}
                  aria-label="Senden"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105 disabled:opacity-40"
                  style={{ background: SEND_BG }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M8 13V3.5M8 3.5 4 7.5M8 3.5l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
});
