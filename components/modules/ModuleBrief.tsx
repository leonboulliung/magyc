"use client";

import { useState } from "react";

/**
 * Brief module — single-sentence mission. Visual identity: pull quote
 * with an opening `❝` glyph hanging at the left, italic editorial type.
 * No header, no chrome — the glyph signals what this is.
 */
export function ModuleBrief({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <span
        className="editorial font-black text-[56px] sm:text-[72px] leading-none -mt-3 sm:-mt-4 opacity-85 select-none shrink-0"
        aria-hidden
      >
        ❝
      </span>
      <p className="italic text-[18px] sm:text-[22px] leading-snug max-w-2xl pt-1 sm:pt-2">
        {text}
      </p>
    </div>
  );
}

/** Single textarea, char counter, save/cancel/remove. */
export function ModuleBriefEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [text, setText] = useState(initial ?? "");
  const remaining = Math.max(0, 240 - text.length);
  return (
    <div className="space-y-3">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 240))}
        rows={3}
        placeholder="A single sentence: why does this exist?"
        className="input resize-none italic"
      />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="mono text-[10px] tracking-widest opacity-60 tabular-nums">
          {remaining} / 240
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
            CANCEL
          </button>
          {onRemove && (
            <button onClick={onRemove} className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
              REMOVE
            </button>
          )}
          <button onClick={() => onSave(text.trim())} className="btn">
            Save brief
          </button>
        </div>
      </div>
    </div>
  );
}
