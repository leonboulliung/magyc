"use client";

import { useState } from "react";

/**
 * Checklist module — unordered to-do items. Visual identity: hollow
 * `☐` glyph before each item, no numbering, slight indent. Reads as a
 * personal punch list rather than a chronological plan.
 *
 * The checkbox is display-only at first — no per-item done/undone
 * state yet. If we add tracking later, the glyph becomes interactive.
 */
export function ModuleChecklist({ items }: { items: string[] }) {
  const clean = items.filter((s) => s.trim());
  if (clean.length === 0) return null;
  return (
    <ul className="space-y-2">
      {clean.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] sm:text-[16px]">
          <span
            className="mono text-[15px] opacity-50 pt-[1px] leading-none shrink-0 select-none"
            aria-hidden
          >
            ☐
          </span>
          <span className="leading-snug flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** One input per item, add/remove, no reorder (unordered list). */
export function ModuleChecklistEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: string[];
  onSave: (items: string[]) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [items, setItems] = useState<string[]>(
    initial && initial.length > 0 ? initial.slice() : [""],
  );
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mono text-[15px] opacity-40 pt-2 leading-none shrink-0 select-none" aria-hidden>
            ☐
          </span>
          <input
            value={item}
            onChange={(e) =>
              setItems((d) => d.map((x, idx) => (idx === i ? e.target.value : x)))
            }
            placeholder="A thing to do…"
            maxLength={160}
            className="input flex-1"
          />
          <button
            onClick={() => setItems((d) => d.filter((_, idx) => idx !== i))}
            className="mono text-[14px] opacity-50 hover:opacity-100 pt-2 shrink-0"
            aria-label="Remove item"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={() => setItems((d) => (d.length >= 12 ? d : [...d, ""]))}
          disabled={items.length >= 12}
          className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 disabled:opacity-30"
        >
          + ADD ITEM
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCancel} className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
            CANCEL
          </button>
          {onRemove && (
            <button onClick={onRemove} className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
              REMOVE
            </button>
          )}
          <button
            onClick={() => onSave(items.map((s) => s.trim()).filter(Boolean))}
            className="btn"
          >
            Save checklist
          </button>
        </div>
      </div>
    </div>
  );
}
