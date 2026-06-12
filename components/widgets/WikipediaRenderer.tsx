"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { Module, WikipediaWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Wikipedia-Einordnung — references a Wikipedia article inline.
 *
 * The classifier supplies a `topic` (article title); the server-side
 * resolver fills `url`, `extract`, and `thumbnailUrl`. When the user
 * regenerates, the new suggestion replaces the topic; the API will
 * re-resolve before persisting.
 *
 * The widget also accepts a custom URL via the prompt-paste path —
 * users can drop a wiki link and the backend turns it into an
 * article. This is the small affordance under the description: paste
 * a URL, hit ↵, the widget swaps to that article.
 */
export function WikipediaRenderer({
  module: m,
  index,
}: {
  module: WikipediaWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [paste, setPaste] = useState("");
  const [pasting, setPasting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Unconfigured = freshly added, no real article yet. The empty state
  // becomes a TOPIC PICKER: context-relevant article suggestions to pick
  // from (or paste a URL), instead of a broken placeholder card.
  const unconfigured = !m.url && (!m.topic || m.topic === "…" || m.topic.trim() === "");
  const [suggestions, setSuggestions] = useState<WikipediaWidget[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Skip the optimistic temp index (>64); the real-index remount after
    // refresh fetches — otherwise a failed temp call burns the rate limit.
    if (!unconfigured || !ctx.isOwner || fetchedRef.current || index > 64) return;
    fetchedRef.current = true;
    setLoadingSuggest(true);
    fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}/regenerate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: 5, anonToken: ctx.ownerToken }),
    })
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j.suggestions)
          ? (j.suggestions as Module[]).filter((s): s is WikipediaWidget => s.type === "wikipedia")
          : [];
        setSuggestions(list);
      })
      .catch(() => {})
      .finally(() => setLoadingSuggest(false));
  }, [unconfigured, ctx.isOwner, ctx.spaceId, ctx.ownerToken, index]);

  async function choose(s: WikipediaWidget) {
    await ctx.saveModule(index, s, {
      resolveExternal: true,
      successMessage: "updated",
      undoModule: m,
    });
  }

  async function applyPasted() {
    const url = paste.trim();
    if (!url) { setPasting(false); return; }
    setBusy(true);
    setError("");
    try {
      const ok = await ctx.saveModule(index, {
        ...m,
        topic: extractTitleFromUrl(url) || m.topic,
        url,
        extract: undefined,
        thumbnailUrl: undefined,
      }, {
        resolveExternal: true,
        successMessage: "updated",
        undoModule: m,
      });
      if (!ok) setError("not applied");
      else { setPaste(""); setPasting(false); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "wikipedia" ? (
          <div className="space-y-0.5">
            <div className="text-[12px] truncate">{s.topic}</div>
            {s.url && (
              <div className="mono text-[9px] opacity-60 truncate">{stripWikiPrefix(s.url)}</div>
            )}
          </div>
        ) : null
      }
    >
      <WidgetCard
        microTitle={
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ color: "var(--v-muted)" }}>W</span>
            <span>{m.microTitle ?? (unconfigured ? "" : m.topic)}</span>
          </span>
        }
        description={m.description}
        attribution={m.attribution ?? { name: "Wikipedia", url: "https://en.wikipedia.org", license: "CC-BY-SA" }}
      >
        {unconfigured && ctx.isOwner ? (
          /* Topic picker — context-relevant article suggestions on add. */
          <div className="space-y-1">
            {loadingSuggest && (
              <div className="mono text-[11px] opacity-40 py-1">…</div>
            )}
            {!loadingSuggest && suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => choose(s)}
                className="w-full text-left px-2 py-1.5 rounded-[var(--v-radius)] hover:bg-black/[0.04] transition-colors"
              >
                <div className="text-[13px] font-medium" style={{ color: "var(--v-fg)" }}>{s.topic}</div>
                {s.extract && (
                  <div
                    className="text-[11px] leading-snug mt-0.5"
                    style={{ color: "var(--v-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {s.extract}
                  </div>
                )}
              </button>
            ))}
            {!loadingSuggest && suggestions.length === 0 && (
              <div className="mono text-[11px] opacity-40 py-1">…</div>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            {m.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.thumbnailUrl}
                alt={m.topic}
                className="rounded-sm object-cover shrink-0"
                style={{ width: 64, height: 64, border: "1px solid var(--v-rule)" }}
              />
            ) : (
              <span
                className="rounded-sm shrink-0 inline-flex items-center justify-center mono text-[18px] opacity-30"
                style={{
                  width: 64,
                  height: 64,
                  background: "var(--v-rule)",
                  border: "1px solid var(--v-rule)",
                  color: "var(--v-fg)",
                }}
              >
                W
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] leading-snug font-medium" style={{ color: "var(--v-fg)" }}>
                {m.topic}
              </div>
              {m.extract && (
                <p
                  className="text-[12px] leading-snug mt-1"
                  style={{ color: "var(--v-muted)" }}
                >
                  {m.extract}
                </p>
              )}
              {m.url && (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mono text-[10px] tracking-widest mt-2 inline-block opacity-70 hover:opacity-100 underline"
                  style={{ color: "var(--v-fg)" }}
                >
                  ↗
                </a>
              )}
            </div>
          </div>
        )}

        {ctx.isOwner && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px dashed var(--v-rule)" }}>
            {pasting ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder="https://…wikipedia.org/wiki/…"
                  maxLength={500}
                  className="flex-1 mono text-[11px] bg-transparent outline-none px-2 py-1 rounded-[var(--v-radius)]"
                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); applyPasted(); }
                    else if (e.key === "Escape") { setPaste(""); setPasting(false); }
                  }}
                />
                <button
                  onClick={applyPasted}
                  disabled={busy || !paste.trim()}
                  className="mono text-[10px] tracking-widest px-3 rounded-full disabled:opacity-30"
                  style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
                >
                  {busy ? "…" : "↵"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPasting(true)}
                className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100"
                style={{ color: "var(--v-fg)" }}
              >
                ⎘ ↗
              </button>
            )}
            {error && (
              <span className="mono text-[10px] tracking-widest ml-2 opacity-70">{error}</span>
            )}
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}

function extractTitleFromUrl(url: string): string | null {
  const m = url.match(/\/wiki\/([^?#]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).replace(/_/g, " "); } catch { return null; }
}

function stripWikiPrefix(url: string): string {
  return url.replace(/^https?:\/\/(?:[a-z-]+\.)?wikipedia\.org\//, "");
}
