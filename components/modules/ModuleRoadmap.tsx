"use client";

import { useState } from "react";

/**
 * Roadmap module — chronological steps. Visual identity: monospaced
 * "01" indices in tabular nums, vertical hairline connector implied by
 * the indent. Reads as an editorial schedule rather than a checklist.
 */
export function ModuleRoadmap({ steps }: { steps: string[] }) {
  const clean = steps.filter((s) => s.trim());
  if (clean.length === 0) return null;
  return (
    <ol className="space-y-2.5">
      {clean.map((step, i) => (
        <li key={i} className="flex items-start gap-4 text-[15px] sm:text-[16px]">
          <span className="mono text-[10px] tracking-widest opacity-50 pt-1 tabular-nums w-7 shrink-0 text-right">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="leading-snug border-l border-rule pl-4 -ml-2 pb-1 flex-1">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Numbered inputs with reorder (▲▼) + remove + add + save/cancel/remove module. */
export function ModuleRoadmapEditor({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: string[];
  onSave: (steps: string[]) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [steps, setSteps] = useState<string[]>(
    initial && initial.length > 0 ? initial.slice() : [""],
  );
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="mono text-[10px] tracking-widest opacity-60 pt-3 tabular-nums w-7 shrink-0 text-right">
            {String(i + 1).padStart(2, "0")}
          </div>
          <input
            value={step}
            onChange={(e) =>
              setSteps((d) => d.map((x, idx) => (idx === i ? e.target.value : x)))
            }
            placeholder="An abstract step…"
            maxLength={160}
            className="input flex-1"
          />
          <div className="flex flex-col gap-0.5 pt-2 shrink-0">
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="mono text-[11px] opacity-50 hover:opacity-100 disabled:opacity-20 leading-none"
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === steps.length - 1}
              className="mono text-[11px] opacity-50 hover:opacity-100 disabled:opacity-20 leading-none"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
          <button
            onClick={() => setSteps((d) => d.filter((_, idx) => idx !== i))}
            className="mono text-[14px] opacity-50 hover:opacity-100 pt-3 shrink-0"
            aria-label="Remove step"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={() => setSteps((d) => (d.length >= 8 ? d : [...d, ""]))}
          disabled={steps.length >= 8}
          className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 disabled:opacity-30"
        >
          + ADD STEP
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
            onClick={() => onSave(steps.map((s) => s.trim()).filter(Boolean))}
            className="btn"
          >
            Save roadmap
          </button>
        </div>
      </div>
    </div>
  );
}
