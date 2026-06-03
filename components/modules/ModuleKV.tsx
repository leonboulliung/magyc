"use client";

import { useState, Fragment } from "react";

/**
 * KV module — key/value sidebar (LOOKS, STACK, GENRE, …). Visual
 * identity: two-column definition list, monospaced UPPERCASE keys on
 * the left, body copy values on the right. Reads as a tech-spec or
 * shot-list sidebar.
 */
export function ModuleKV({ entries }: { entries: { key: string; value: string }[] }) {
  const clean = entries.filter((e) => e.key.trim() && e.value.trim());
  if (clean.length === 0) return null;
  return (
    <dl className="grid grid-cols-[6rem_1fr] sm:grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-[14px] sm:text-[15px]">
      {clean.map((e, i) => (
        <Fragment key={i}>
          <dt className="mono text-[10px] tracking-widest opacity-70 pt-1">{e.key}</dt>
          <dd className="leading-snug whitespace-pre-wrap">{e.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Key + value inputs per row, add/remove. Keys auto-upper. */
export function ModuleKVEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: { key: string; value: string }[];
  onSave: (entries: { key: string; value: string }[]) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [entries, setEntries] = useState<{ key: string; value: string }[]>(
    initial && initial.length > 0 ? initial.slice() : [{ key: "", value: "" }],
  );

  const updateKey = (i: number, k: string) =>
    setEntries((d) =>
      d.map((e, idx) =>
        idx === i ? { ...e, key: k.toUpperCase().replace(/\s+/g, "-").slice(0, 12) } : e,
      ),
    );
  const updateVal = (i: number, v: string) =>
    setEntries((d) => d.map((e, idx) => (idx === i ? { ...e, value: v.slice(0, 200) } : e)));

  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={i} className="flex items-start gap-2">
          <input
            value={e.key}
            onChange={(ev) => updateKey(i, ev.target.value)}
            placeholder="LABEL"
            className="input mono w-24 sm:w-28 tracking-widest text-[11px] uppercase shrink-0"
            maxLength={12}
          />
          <input
            value={e.value}
            onChange={(ev) => updateVal(i, ev.target.value)}
            placeholder="value"
            className="input flex-1"
            maxLength={200}
          />
          <button
            onClick={() => setEntries((d) => d.filter((_, idx) => idx !== i))}
            className="mono text-[14px] opacity-50 hover:opacity-100 pt-2 shrink-0"
            aria-label="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={() =>
            setEntries((d) => (d.length >= 6 ? d : [...d, { key: "", value: "" }]))
          }
          disabled={entries.length >= 6}
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
                entries
                  .map((e) => ({ key: e.key.trim(), value: e.value.trim() }))
                  .filter((e) => e.key && e.value),
              )
            }
            className="btn"
          >
            Save details
          </button>
        </div>
      </div>
    </div>
  );
}
