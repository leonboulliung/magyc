"use client";

import { useState } from "react";

/**
 * Setlist module — programme during the event. Visual identity:
 * monospaced time-stamps left, editorial titles right, fine vertical
 * rule running down the middle. Reads as a concert / dinner / film-
 * night programme, distinct from Roadmap (which is preparation).
 *
 * Time is optional per row and free-form short (HH or HH:MM).
 */
export function ModuleSetlist({
  items,
}: {
  items: { time?: string; title: string }[];
}) {
  const clean = items.filter((i) => i.title.trim());
  if (clean.length === 0) return null;
  return (
    <ol className="space-y-1.5">
      {clean.map((it, i) => (
        <li key={i} className="grid grid-cols-[4rem_auto_1fr] gap-3 items-baseline text-[15px] sm:text-[16px]">
          <span className="mono text-[11px] tracking-widest opacity-60 tabular-nums text-right pt-1">
            {it.time || "—"}
          </span>
          <span className="opacity-30 select-none" aria-hidden>·</span>
          <span className="leading-snug">{it.title}</span>
        </li>
      ))}
    </ol>
  );
}

/** Two inputs per row: short time + title. Add / remove rows. */
export function ModuleSetlistEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: { time?: string; title: string }[];
  onSave: (items: { time?: string; title: string }[]) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [items, setItems] = useState<{ time: string; title: string }[]>(
    initial && initial.length > 0
      ? initial.map((it) => ({ time: it.time ?? "", title: it.title }))
      : [{ time: "", title: "" }],
  );
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <input
            value={it.time}
            onChange={(e) =>
              setItems((d) =>
                d.map((x, idx) => (idx === i ? { ...x, time: e.target.value.slice(0, 10) } : x)),
              )
            }
            placeholder="20:00"
            maxLength={10}
            className="input mono w-20 tabular-nums text-[12px] shrink-0"
          />
          <input
            value={it.title}
            onChange={(e) =>
              setItems((d) =>
                d.map((x, idx) => (idx === i ? { ...x, title: e.target.value.slice(0, 120) } : x)),
              )
            }
            placeholder="What happens next…"
            maxLength={120}
            className="input flex-1"
          />
          <button
            onClick={() => setItems((d) => d.filter((_, idx) => idx !== i))}
            className="mono text-[14px] opacity-50 hover:opacity-100 pt-2 shrink-0"
            aria-label="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={() => setItems((d) => (d.length >= 12 ? d : [...d, { time: "", title: "" }]))}
          disabled={items.length >= 12}
          className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 disabled:opacity-30"
        >
          + ADD ROW
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
            onClick={() =>
              onSave(
                items
                  .map((it) => ({ time: it.time.trim(), title: it.title.trim() }))
                  .filter((it) => it.title)
                  .map((it) => {
                    const okTime = /^\d{1,2}(:\d{2})?$/.test(it.time);
                    return okTime ? { time: it.time, title: it.title } : { title: it.title };
                  }),
              )
            }
            className="btn"
          >
            Save setlist
          </button>
        </div>
      </div>
    </div>
  );
}
