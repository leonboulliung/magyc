"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Bring module — what participants bring along. Visual identity:
 * rounded filled pills, each item a soft ink token. Reads as a casual
 * cloud, no order, no checkbox.
 */
export function ModuleBring({ items }: { items: string[] }) {
  const clean = items.filter((s) => s.trim());
  if (clean.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {clean.map((item, i) => (
        <span
          key={i}
          className="mono text-[11px] tracking-widest uppercase rounded-full bg-ink/[0.06] text-ink px-3 py-1.5"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/** Type, hit Enter or comma to add a pill. Tap × on a pill to remove. */
export function ModuleBringEditor({
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
  const [items, setItems] = useState<string[]>(initial?.slice() ?? []);
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const v = raw.trim().slice(0, 80);
    if (!v) return;
    if (items.includes(v)) {
      setDraft("");
      return;
    }
    if (items.length >= 16) return;
    setItems([...items, v]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && items.length > 0) {
      setItems(items.slice(0, -1));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl border border-rule-strong min-h-[3rem]">
        {items.map((item, i) => (
          <span
            key={i}
            className="mono text-[11px] tracking-widest uppercase rounded-full bg-ink/[0.06] text-ink pl-3 pr-1.5 py-1 inline-flex items-center gap-1.5"
          >
            {item}
            <button
              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              className="opacity-50 hover:opacity-100 text-[12px] leading-none"
              aria-label="Remove"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 80))}
          onKeyDown={onKey}
          onBlur={() => draft && commit(draft)}
          placeholder={items.length === 0 ? "Type, then Enter…" : ""}
          className="flex-1 min-w-[8rem] bg-transparent outline-none px-2 py-1 text-[13px]"
        />
      </div>
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums">
          {items.length} / 16
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCancel} className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
            CANCEL
          </button>
          {onRemove && (
            <button onClick={onRemove} className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
              REMOVE
            </button>
          )}
          <button onClick={() => onSave(items)} className="btn">
            Save bring-list
          </button>
        </div>
      </div>
    </div>
  );
}
