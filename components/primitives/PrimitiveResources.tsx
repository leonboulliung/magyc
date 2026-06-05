"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import type { Contribution } from "@/lib/types";

/**
 * Resources — an empty slot for visitors to add real links. The
 * composer never invents URLs; everything here comes from people.
 * Each contribution is a URL + an optional caption.
 */
export function PrimitiveResources({
  spaceId,
  primitiveIndex,
  contributions,
  onChanged,
}: {
  spaceId: string;
  primitiveIndex: number;
  contributions: Contribution[];
  onChanged: () => void;
}) {
  const items = contributions
    .filter((c) => c.kind === "resource")
    .sort((a, b) => a.createdAt - b.createdAt);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const looksLikeUrl = /^https?:\/\/[^\s]+$/i.test(url.trim());

  async function submit() {
    if (busy) return;
    if (!looksLikeUrl) {
      setErr("Eine URL muss mit http:// oder https:// anfangen.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/spaces/${spaceId}/contributions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primitiveIndex,
          kind: "resource",
          data: caption.trim()
            ? { url: url.trim(), caption: caption.trim() }
            : { url: url.trim() },
        }),
      });
      if (res.ok) {
        setUrl("");
        setCaption("");
        onChanged();
      } else {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error || "Konnte nicht hinzufügen.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70 flex justify-between">
        <span>REFERENZEN</span>
        <span className="tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 mono text-[11px] opacity-50">
          Noch nichts. Wenn jemand einen Link oder eine Referenz hat — hier rein.
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {items.map((r) => (
            <li key={r.id} className="px-4 py-3">
              {r.data.kind === "resource" && (
                <>
                  <a
                    href={r.data.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[14px] leading-snug break-all hover:underline"
                  >
                    {r.data.url}
                  </a>
                  {r.data.caption && (
                    <p className="text-[13px] opacity-80 mt-1">{r.data.caption}</p>
                  )}
                  <div className="mono text-[10px] tracking-widest opacity-60 mt-1">
                    @{r.user.displayName}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-rule p-3 space-y-2">
        <SignedIn>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            maxLength={500}
            className="w-full text-[14px] p-2.5 bg-paper border border-rule rounded-xl focus:outline-none focus:border-ink"
            disabled={busy}
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Kurze Bemerkung (optional)"
            maxLength={120}
            className="w-full text-[14px] p-2.5 bg-paper border border-rule rounded-xl focus:outline-none focus:border-ink"
            disabled={busy}
          />
          {err && <p className="mono text-[10px] opacity-80">{err}</p>}
          <div className="flex items-center justify-end">
            <button
              onClick={submit}
              disabled={busy || !looksLikeUrl}
              className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full bg-ink text-paper hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? "…" : "REFERENZ HINZUFÜGEN →"}
            </button>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full mono text-[10px] tracking-widest px-3 py-2 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
              SIGN IN, UM REFERENZEN ZU TEILEN →
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </section>
  );
}
