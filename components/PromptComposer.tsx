"use client";

import { forwardRef, type ReactNode } from "react";

/**
 * Shared prompt field — the single source of truth for the "describe your
 * project" box used both on the marketing homepage and inside the Studio
 * (/studio/new), so the two surfaces look and feel identical.
 *
 * It owns only the glass card + textarea + a chip/counter row; the page
 * supplies its own context (mode chips or preset picker via `topSlot`,
 * example/fast-prompt chips via `chips`, and the submit affordance via
 * `footer`). Slightly more compact than the old hero card to feel less bulky.
 */
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
  return (
    <div
      id={id}
      className={`liquid-glass-strong w-full rounded-[28px] p-5 transition-shadow duration-300 sm:rounded-[32px] sm:p-6 ${className ?? ""}`}
      style={{
        boxShadow: highlight
          ? "0 0 0 1px rgba(255,255,255,0.62), 0 18px 60px rgba(0,0,0,0.22), 0 0 38px rgba(255,255,255,0.13), inset 0 1px 1px rgba(255,255,255,0.15)"
          : "0 18px 60px rgba(0,0,0,0.22), inset 0 1px 1px rgba(255,255,255,0.15)",
      }}
    >
      {topSlot && <div className="mb-4">{topSlot}</div>}

      <textarea
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/85 disabled:opacity-40"
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
  );
});
