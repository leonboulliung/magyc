"use client";

import { useState, useCallback, useRef } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { GifWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * GIF — a single looping gif from Tenor/Giphy (via the /api/gif proxy,
 * keys server-side).
 *
 * One inline search surface serves both cases: a freshly-added gif
 * (unconfigured) shows the search as its empty state, and swapping a
 * configured gif reuses the same panel. No modal — the picker lives in
 * the card itself.
 */
export function GifRenderer({
  module: m,
  index,
}: {
  module: GifWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [swapping, setSwapping] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/gif?q=${encodeURIComponent(q.trim())}&limit=12`);
      const json = await res.json().catch(() => ({ results: [] }));
      setResults(Array.isArray(json.results) ? json.results : []);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  }

  async function pick(r: GifResult) {
    setSwapping(false);
    setResults([]);
    setQuery("");
    const next = { ...m, gifUrl: r.gifUrl, thumbnailUrl: r.thumbnailUrl };
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ widget: next, anonOwnerToken: ctx.ownerToken }),
    });
    ctx.patchModule(index, next);
  }

  // A freshly-added GIF carries a placeholder loading.gif — treat that
  // as unconfigured so the empty state IS the search.
  const unconfigured = !m.gifUrl || /loading\.gif/i.test(m.gifUrl);
  const showSearch = ctx.isOwner && (unconfigured || swapping);

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "gif" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbnailUrl || s.gifUrl} alt="" className="h-10 object-cover rounded" />
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {showSearch ? (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="mono text-[12px] opacity-40" style={{ color: "var(--v-fg)" }}>▷</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="…"
                maxLength={100}
                className="flex-1 text-[13px] bg-transparent outline-none"
                style={{ color: "var(--v-fg)" }}
              />
              {loading && <span className="mono text-[11px] opacity-40">…</span>}
              {!unconfigured && (
                <button
                  type="button"
                  onClick={() => { setSwapping(false); setResults([]); setQuery(""); }}
                  aria-label="cancel"
                  className="mono text-[12px] opacity-50 hover:opacity-100"
                  style={{ color: "var(--v-fg)" }}
                >
                  ×
                </button>
              )}
            </div>
            {results.length > 0 && (
              <div className="grid gap-0.5 overflow-y-auto" style={{ gridTemplateColumns: "repeat(3, 1fr)", maxHeight: 240 }}>
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pick(r)}
                    className="overflow-hidden rounded-sm hover:opacity-80 transition-opacity"
                    style={{ aspectRatio: "1/1" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumbnailUrl || r.gifUrl} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            {query && results.length === 0 && !loading && (
              <div className="mono text-[11px] px-1 py-3 text-center opacity-50" style={{ color: "var(--v-muted)" }}>…</div>
            )}
          </div>
        ) : unconfigured ? (
          <div className="flex items-center justify-center py-10 mono text-[11px] tracking-widest opacity-30" style={{ color: "var(--v-muted)" }}>
            ▷
          </div>
        ) : (
          <div className="relative overflow-hidden" style={{ minHeight: 160 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.gifUrl}
              alt={m.microTitle || "gif"}
              className="w-full object-cover block"
              style={{ maxHeight: 300 }}
            />
            {ctx.isOwner && (
              <button
                type="button"
                onClick={() => setSwapping(true)}
                aria-label="change gif"
                className="absolute top-2 right-2 mono text-[10px] tracking-widest px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                ⎘
              </button>
            )}
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}

interface GifResult {
  id: string;
  gifUrl: string;
  thumbnailUrl: string;
  title: string;
}
