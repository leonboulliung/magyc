"use client";

import { useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { WikipediaWidget } from "@/lib/types";
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

  async function applyPasted() {
    const url = paste.trim();
    if (!url) { setPasting(false); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          widget: { ...m, topic: extractTitleFromUrl(url) || m.topic, url, extract: undefined, thumbnailUrl: undefined },
          anonOwnerToken: ctx.ownerToken,
          resolveExternal: true,
        }),
      });
      if (!res.ok) setError("✕");
      else { setPaste(""); setPasting(false); }
    } finally {
      setBusy(false);
      ctx.refresh();
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
            <span>{m.microTitle ?? m.topic}</span>
          </span>
        }
        description={m.description}
        attribution={m.attribution ?? { name: "Wikipedia", url: "https://en.wikipedia.org", license: "CC-BY-SA" }}
      >
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
                  className="flex-1 mono text-[11px] bg-transparent outline-none px-2 py-1 rounded-md"
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
