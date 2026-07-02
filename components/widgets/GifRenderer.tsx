"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { GifWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * GIF — a single looping gif from Tenor/Giphy (via the /api/gif proxy,
 * keys server-side).
 *
 * Empty state is a real, roomy picker: it seeds a topic search from the
 * space's title so relevant gifs show up front (making it obvious this
 * is a gif search), with the search field underneath. A configured gif
 * is clipped to the card's corners and re-opens the picker on click.
 */
const SEARCH_PLACEHOLDER: Record<string, string> = {
  en: "Search GIFs…", de: "GIFs suchen…", fr: "Rechercher des GIF…",
  es: "Buscar GIFs…", it: "Cerca GIF…", pt: "Pesquisar GIFs…", nl: "GIF's zoeken…",
};
function searchPlaceholder(lang: string): string {
  return SEARCH_PLACEHOLDER[(lang || "en").toLowerCase().split("-")[0]] ?? SEARCH_PLACEHOLDER.en!;
}

/** A short, searchable keyword from a phrase — gif APIs return nothing
 *  for a long, specific title, but the first real word ("Flohmarkt")
 *  matches. Picks the first ≥3-char alphanumeric token. */
function topicSeed(s: string): string {
  const word = s
    .split(/[\s\-–—_/]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .find((w) => w.length > 2);
  return word ?? "";
}

interface GifResult {
  id: string;
  gifUrl: string;
  thumbnailUrl: string;
  title: string;
}

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
  const seededRef = useRef(false);

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
    debounceRef.current = setTimeout(() => search(v), 350);
  }

  async function pick(r: GifResult) {
    setSwapping(false);
    setResults([]);
    setQuery("");
    seededRef.current = true; // don't re-seed after a pick
    const next = { ...m, gifUrl: r.gifUrl, thumbnailUrl: r.thumbnailUrl };
    await ctx.saveModule(index, next, { successMessage: "updated", undoModule: m });
  }

  // A freshly-added GIF carries a placeholder loading.gif — treat that
  // as unconfigured so the empty state IS the search.
  const unconfigured = !m.gifUrl || /loading\.gif/i.test(m.gifUrl);
  const showSearch = ctx.isOwner && (unconfigured || swapping);

  // Seed the picker with topic-relevant gifs the first time it opens,
  // so the user immediately sees gifs (and that this is a search).
  useEffect(() => {
    if (!showSearch || seededRef.current) return;
    seededRef.current = true;
    const seed = topicSeed(m.microTitle || "") || topicSeed(ctx.title || "");
    if (seed) { setQuery(seed); void search(seed); }
  }, [showSearch, m.microTitle, ctx.title, search]);

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
          <div className="p-3 space-y-2.5" style={{ minHeight: 220 }}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-full"
              style={{ border: "1px solid var(--v-rule)" }}
            >
              <span aria-hidden className="mono text-[13px] opacity-40" style={{ color: "var(--v-fg)" }}>▷</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={searchPlaceholder(ctx.language)}
                maxLength={100}
                className="flex-1 text-[14px] bg-transparent outline-none"
                style={{ color: "var(--v-fg)" }}
              />
              {loading && <span className="mono text-[11px] opacity-40">…</span>}
              {!unconfigured && (
                <button
                  type="button"
                  onClick={() => { setSwapping(false); setResults([]); setQuery(""); }}
                  aria-label="cancel"
                  className="mono text-[13px] opacity-50 hover:opacity-100"
                  style={{ color: "var(--v-fg)" }}
                >
                  ×
                </button>
              )}
            </div>
            {results.length > 0 ? (
              <div className="grid gap-1 overflow-y-auto" style={{ gridTemplateColumns: "repeat(3, 1fr)", maxHeight: 280 }}>
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pick(r)}
                    className="overflow-hidden rounded-md hover:opacity-80 transition-opacity"
                    style={{ aspectRatio: "1/1", border: "1px solid var(--v-rule)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumbnailUrl || r.gifUrl} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center text-center px-4" style={{ minHeight: 140 }}>
                <span className="text-[12px] leading-relaxed opacity-45" style={{ color: "var(--v-muted)" }}>
                  {loading ? "…" : query ? "—" : searchPlaceholder(ctx.language)}
                </span>
              </div>
            )}
          </div>
        ) : unconfigured ? (
          <div className="flex items-center justify-center py-12 mono text-[12px] tracking-widest opacity-30" style={{ color: "var(--v-muted)" }}>
            ▷
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { if (ctx.isOwner) setSwapping(true); }}
            disabled={!ctx.isOwner}
            className="group/gif relative block w-full overflow-hidden"
            style={{ borderRadius: "var(--v-radius)", cursor: ctx.isOwner ? "pointer" : "default" }}
            title={ctx.isOwner ? "tap to change" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.gifUrl}
              alt={m.microTitle || "gif"}
              className="w-full object-cover block"
              style={{ maxHeight: 320 }}
            />
            {ctx.isOwner && (
              <span
                className="touch-visible absolute bottom-2 left-2 mono text-[10px] tracking-widest px-2 py-1 rounded-full opacity-0 group-hover/gif:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                ⎘ change
              </span>
            )}
          </button>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
