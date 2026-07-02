"use client";

import { useEffect, useRef, useState } from "react";

export type LocationPoint = { lng: number; lat: number; label?: string };

type GeoMatch = { label: string; lng: number; lat: number };

/** Shared place editor used everywhere a project or preset configures places. */
export function LocationPointsEditor({
  points,
  onChange,
  minItems,
  addLabel = "+ Ort hinzufügen",
}: {
  points: LocationPoint[];
  onChange: (points: LocationPoint[]) => void;
  minItems: number;
  addLabel?: string;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`);
        const json = await response.json().catch(() => ({ results: [] }));
        setResults(Array.isArray(json.results) ? json.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  }

  function begin(target: number | "new") {
    setEditing(target);
    setQuery(target === "new" ? "" : points[target]?.label ?? "");
    setResults([]);
  }

  function pick(match: GeoMatch) {
    if (editing === "new") onChange([...points, match]);
    else if (typeof editing === "number") onChange(points.map((point, index) => index === editing ? match : point));
    setEditing(null);
    setResults([]);
    setQuery("");
  }

  return (
    <div className="relative z-20 px-3.5 pb-3 pt-1">
      <div className="space-y-1.5">
        {points.map((point, index) => (
          <div key={`${point.lng}-${point.lat}-${index}`} className="group/location flex min-w-0 items-center gap-2 rounded-[var(--v-radius)] px-3 py-2" style={{ border: "1px solid var(--v-rule)" }}>
            <span className="mono shrink-0 text-[10px] opacity-45" style={{ color: "var(--v-muted)" }}>{index + 1}</span>
            <button type="button" onClick={() => begin(index)} className="min-w-0 flex-1 truncate text-left text-[12px]" style={{ color: "var(--v-fg)" }}>
              {point.label || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
            </button>
            <button type="button" onClick={() => begin(index)} className="text-[10px] opacity-60 transition-opacity hover:opacity-100" style={{ color: "var(--v-muted)" }}>Bearbeiten</button>
            {points.length > minItems && (
              <button type="button" onClick={() => onChange(points.filter((_, current) => current !== index))} aria-label="Ort entfernen" className="mono grid h-5 w-5 place-items-center rounded-full text-[12px] opacity-45 hover:opacity-100" style={{ color: "var(--v-muted)" }}>×</button>
            )}
          </div>
        ))}
      </div>

      {editing !== null ? (
        <div className="relative mt-2">
          <input
            autoFocus
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); else if (event.key === "Enter" && results[0]) pick(results[0]); }}
            placeholder="Ort oder Adresse suchen"
            className="w-full rounded-[var(--v-radius)] bg-transparent px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
          />
          {loading && <span className="mono absolute right-3 top-2.5 text-[10px] opacity-45">…</span>}
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-[var(--v-radius)]" style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)", boxShadow: "0 12px 28px rgba(0,0,0,0.22)" }}>
              <div className="max-h-52 overflow-y-auto">
              {results.map((result, index) => (
                <button key={`${result.lng}-${result.lat}-${index}`} type="button" onMouseDown={(event) => { event.preventDefault(); pick(result); }} className="flex w-full items-start gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.06]" style={{ color: "var(--v-fg)", borderBottom: "1px solid var(--v-rule)" }}>
                  <span aria-hidden className="mt-0.5 opacity-45">⊙</span>
                  <span>{result.label}</span>
                </button>
              ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => begin("new")} className="mono mt-2 rounded-full px-3 py-1.5 text-[10px] tracking-widest opacity-70 transition-opacity hover:opacity-100" style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}>
          {addLabel}
        </button>
      )}
    </div>
  );
}
