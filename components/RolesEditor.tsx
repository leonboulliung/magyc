"use client";

import { useState } from "react";

/**
 * RolesEditor — small chip-based editor for predefined role labels on
 * a thing. Used in CardCreate (draft) and PostDetail's EditModal.
 *
 * Labels are free text (≤ 40 chars). The component keeps them deduped
 * (case-insensitive) and capped at 8. No validation beyond trimming —
 * the server runs the same sanitizer on submit.
 */
export function RolesEditor({
  value,
  onChange,
  suggestions,
  onSuggest,
  suggestBusy,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional pool of AI-proposed labels the owner can add with one tap. */
  suggestions?: string[];
  /** Optional handler to trigger AI suggestion. When set, a "✨ SUGGEST" button shows. */
  onSuggest?: () => void;
  suggestBusy?: boolean;
}) {
  const [pending, setPending] = useState("");

  function addLabel(raw: string) {
    const clean = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) return;
    if (value.length >= 8) return;
    if (value.some((v) => v.toLowerCase() === clean.toLowerCase())) return;
    onChange([...value, clean]);
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="mono text-[10px] tracking-widest opacity-70 flex items-center justify-between">
        <span>RÖLLEN — WER WIRD GEBRAUCHT?</span>
        {onSuggest && (
          <button
            type="button"
            onClick={onSuggest}
            disabled={!!suggestBusy}
            className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100"
          >
            {suggestBusy ? "…" : "✨ AI VORSCHLAG"}
          </button>
        )}
      </label>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((label, idx) => (
            <span
              key={`${label}-${idx}`}
              className="inline-flex items-center gap-1.5 mono text-[10px] tracking-widest rounded-full border border-rule-strong bg-paper px-2.5 py-1"
            >
              <span>{label.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label={`Remove ${label}`}
                className="opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {value.length < 8 && (
        <div className="mt-2 flex gap-2">
          <input
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addLabel(pending);
                setPending("");
              }
            }}
            onBlur={() => {
              if (pending) {
                addLabel(pending);
                setPending("");
              }
            }}
            placeholder="z. B. Foto, Tontechnik, Snacks-Pate"
            maxLength={40}
            className="input flex-1"
          />
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions
            .filter(
              (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
            )
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addLabel(s)}
                className="mono text-[10px] tracking-widest rounded-full border border-rule-strong bg-paper px-2.5 py-1 hover:bg-ink hover:text-paper transition-colors"
              >
                + {s.toUpperCase()}
              </button>
            ))}
        </div>
      )}

      <p className="mono text-[10px] tracking-widest opacity-50 mt-2">
        Pro Rolle ein Slot. Wer joint, schnappt sich eine. Lass leer wenn
        offen für alle.
      </p>
    </div>
  );
}
