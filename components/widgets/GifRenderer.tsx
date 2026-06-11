"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { GifWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * GIF — a single looping gif from Tenor or Giphy.
 *
 * The owner can swap the gif via a search bar that queries the
 * /api/gif proxy endpoint (keeps API keys server-side). The
 * suggestions popover shows a 3-column thumbnail grid; picking one
 * writes back via PUT and exits the picker.
 *
 * Regenerate is handled by WidgetShell (the regenerate server path
 * already has a `gif` handler stub). The search picker is an
 * additional owner-only overlay.
 */
export function GifRenderer({
  module: m,
  index,
}: {
  module: GifWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [searching2, setSearching2] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching2(true);
    try {
      const res = await fetch(`/api/gif?q=${encodeURIComponent(q.trim())}&limit=12`);
      const json = await res.json().catch(() => ({ results: [] }));
      setResults(Array.isArray(json.results) ? json.results : []);
    } finally {
      setSearching2(false);
    }
  }, []);

  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  }

  async function pick(r: GifResult) {
    setSearching(false);
    setResults([]);
    setQuery("");
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, gifUrl: r.gifUrl, thumbnailUrl: r.thumbnailUrl },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    ctx.patchModule(index, { ...m, gifUrl: r.gifUrl, thumbnailUrl: r.thumbnailUrl });
  }

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
        {/* Main GIF */}
        <div className="relative overflow-hidden" style={{ minHeight: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.gifUrl}
            alt={m.microTitle || "gif"}
            className="w-full object-cover block"
            style={{ maxHeight: 300 }}
          />

          {/* Owner swap overlay */}
          {ctx.isOwner && (
            <button
              type="button"
              onClick={() => setSearching(true)}
              aria-label="change gif"
              className="absolute top-2 right-2 mono text-[10px] tracking-widest px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              ⎘
            </button>
          )}
        </div>

        {/* Search modal */}
        <AnimatePresence>
          {searching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={(e) => { if (e.target === e.currentTarget) { setSearching(false); setResults([]); setQuery(""); } }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 8 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-sm rounded-md overflow-hidden"
                style={{ background: "var(--v-bg)", border: "1px solid var(--v-rule)" }}
              >
                {/* Search input */}
                <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid var(--v-rule)" }}>
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="…"
                    maxLength={100}
                    className="flex-1 text-[13px] bg-transparent outline-none"
                    style={{ color: "var(--v-fg)" }}
                  />
                  {searching2 && <span className="mono text-[11px] opacity-50">…</span>}
                  <button
                    onClick={() => { setSearching(false); setResults([]); setQuery(""); }}
                    className="mono text-[12px] opacity-50 hover:opacity-100"
                    style={{ color: "var(--v-fg)" }}
                  >
                    ×
                  </button>
                </div>

                {/* Results grid */}
                {results.length > 0 && (
                  <div
                    className="grid gap-0.5 p-0.5 overflow-y-auto"
                    style={{ gridTemplateColumns: "repeat(3, 1fr)", maxHeight: 300 }}
                  >
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pick(r)}
                        className="overflow-hidden rounded-sm hover:opacity-80 transition-opacity"
                        style={{ aspectRatio: "1/1" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.thumbnailUrl || r.gifUrl}
                          alt={r.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {query && results.length === 0 && !searching2 && (
                  <div className="mono text-[11px] px-4 py-5 text-center opacity-50" style={{ color: "var(--v-muted)" }}>
                    …
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Owner search button when not searching */}
        {ctx.isOwner && !searching && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setSearching(true)}
              className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
              style={{ color: "var(--v-fg)" }}
            >
              ⎘ gif
            </button>
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
