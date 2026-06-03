"use client";

import { useState } from "react";

/**
 * Reflist module — external references with optional captions. Visual
 * identity: hairline-separated rows, "↗" trailing the link, mono
 * captions opacity-soft below. Reads as a small bibliography rather
 * than a pill cloud.
 */
export function ModuleReflist({
  items,
}: {
  items: { url: string; caption?: string }[];
}) {
  const clean = items.filter((i) => i.url.trim());
  if (clean.length === 0) return null;
  return (
    <ul className="divide-y divide-rule -my-2">
      {clean.map((r, i) => {
        const pretty = r.url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
        return (
          <li key={i} className="py-2.5">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[14px] sm:text-[15px] hover:underline break-all"
            >
              {pretty} <span className="opacity-50">↗</span>
            </a>
            {r.caption && (
              <div className="mono text-[10px] tracking-widest opacity-60 mt-0.5">
                {r.caption.toUpperCase()}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** URL + optional caption per row. Add / remove. */
export function ModuleReflistEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: { url: string; caption?: string }[];
  onSave: (items: { url: string; caption?: string }[]) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [rows, setRows] = useState<{ url: string; caption: string }[]>(
    initial && initial.length > 0
      ? initial.map((r) => ({ url: r.url, caption: r.caption ?? "" }))
      : [{ url: "", caption: "" }],
  );

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
          <input
            value={r.url}
            onChange={(e) =>
              setRows((d) => d.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))
            }
            placeholder="https://…"
            maxLength={500}
            className="input flex-1 min-w-[220px]"
          />
          <input
            value={r.caption}
            onChange={(e) =>
              setRows((d) =>
                d.map((x, idx) => (idx === i ? { ...x, caption: e.target.value.slice(0, 120) } : x)),
              )
            }
            placeholder="caption (optional)"
            maxLength={120}
            className="input flex-1 min-w-[160px]"
          />
          <button
            onClick={() => setRows((d) => d.filter((_, idx) => idx !== i))}
            className="mono text-[14px] opacity-50 hover:opacity-100 pt-2 shrink-0"
            aria-label="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={() => setRows((d) => (d.length >= 12 ? d : [...d, { url: "", caption: "" }]))}
          disabled={rows.length >= 12}
          className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 disabled:opacity-30"
        >
          + ADD REF
        </button>
        <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums">
          {rows.length} / 12
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
          <button
            onClick={() =>
              onSave(
                rows
                  .map((r) => ({ url: r.url.trim(), caption: r.caption.trim() }))
                  .filter((r) => /^https?:\/\/[^\s]+$/i.test(r.url))
                  .map((r) => (r.caption ? { url: r.url, caption: r.caption } : { url: r.url })),
              )
            }
            className="btn"
          >
            Save reflist
          </button>
        </div>
      </div>
    </div>
  );
}
