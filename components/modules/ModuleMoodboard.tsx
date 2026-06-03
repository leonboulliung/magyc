"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Moodboard module — visual references. Visual identity: a CSS grid of
 * square thumbnails with subtle paper inset, captions on hover. Reads
 * as a Pinterest / Are.na compactboard rather than a list.
 *
 * For now the refs are URL-only (no upload); we trust the browser to
 * fetch the image. Broken URLs are flagged with a small placeholder
 * pattern so the editor surface stays legible.
 */
export function ModuleMoodboard({
  refs,
}: {
  refs: { url: string; caption?: string }[];
}) {
  const clean = refs.filter((r) => r.url.trim());
  if (clean.length === 0) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
      {clean.map((r, i) => (
        <a
          key={i}
          href={r.url}
          target="_blank"
          rel="noreferrer noopener"
          className="group block relative aspect-square overflow-hidden bg-ink/[0.04] rounded-md"
          title={r.caption || r.url}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.url}
            alt={r.caption || ""}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {r.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-ink/70 text-paper mono text-[9px] tracking-widest px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
              {r.caption.toUpperCase()}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

/** Paste-row editor: URL + optional caption per row, add/remove. */
export function ModuleMoodboardEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: { url: string; caption?: string }[];
  onSave: (refs: { url: string; caption?: string }[]) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [rows, setRows] = useState<{ url: string; caption: string }[]>(
    initial && initial.length > 0
      ? initial.map((r) => ({ url: r.url, caption: r.caption ?? "" }))
      : [{ url: "", caption: "" }],
  );

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Enter" && i === rows.length - 1 && rows.length < 12) {
      e.preventDefault();
      setRows([...rows, { url: "", caption: "" }]);
    }
  };

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
          <input
            value={r.url}
            onChange={(e) =>
              setRows((d) => d.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))
            }
            onKeyDown={(e) => onKey(e, i)}
            placeholder="https://… an image URL"
            maxLength={500}
            className="input flex-1 min-w-[200px]"
          />
          <input
            value={r.caption}
            onChange={(e) =>
              setRows((d) =>
                d.map((x, idx) => (idx === i ? { ...x, caption: e.target.value.slice(0, 80) } : x)),
              )
            }
            placeholder="caption (optional)"
            maxLength={80}
            className="input flex-1 min-w-[160px]"
          />
          <button
            onClick={() => setRows((d) => d.filter((_, idx) => idx !== i))}
            className="mono text-[14px] opacity-50 hover:opacity-100 pt-2 shrink-0"
            aria-label="Remove ref"
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
            Save moodboard
          </button>
        </div>
      </div>
    </div>
  );
}
