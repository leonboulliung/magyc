"use client";

import { useState } from "react";
import { Header } from "./Header";
import type { CardDraft } from "./CardCreate";

/**
 * The free text entry to the create flow.
 *
 * Type a sentence about what you want to do — the model abstracts it
 * into a CardDraft and hands off to the structured form, which the
 * user then iterates on.
 *
 * No kind toggle: a card is a card now. Cards without a time / place
 * are just open-ended cards.
 *
 * If the AI call fails or is rate-limited, we still proceed — with the
 * raw sentence carried as the title so nothing the user typed is lost.
 */
export function PromptStep({
  onProceed,
  onClose,
}: {
  onProceed: (draft: CardDraft | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      // No real input — open a blank form.
      onProceed(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cards/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          nowParisIso: new Date().toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "rate_limited") {
          setError("Just a moment — try again in a few seconds.");
          return;
        }
        // Soft fallback: open the form with the raw text as title so the
        // user's input isn't lost.
        onProceed({ title: trimmed.slice(0, 80) });
        return;
      }
      if (json?.draft) {
        onProceed(json.draft as CardDraft);
      } else {
        onProceed({ title: trimmed.slice(0, 80) });
      }
    } catch {
      onProceed({ title: trimmed.slice(0, 80) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain animate-fadeIn">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
          <div className="mono text-[10px] tracking-widest opacity-60">CREATE</div>
          <h1 className="editorial font-black text-[40px] sm:text-[64px] leading-[0.95] mt-3">
            What do you want to do?
          </h1>
          <p className="mono text-[12px] opacity-70 leading-relaxed mt-4 max-w-xl">
            Just write what&rsquo;s on your mind. The app builds the rest with
            you — title, place, who&rsquo;s needed. You stay in control.
          </p>

          <div className="mt-8">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={600}
              placeholder="e.g. I want to start a small reading circle near Canal Saint-Martin, monthly."
              className="input w-full text-[18px] leading-relaxed resize-none"
              disabled={busy}
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="mono text-[10px] tracking-widest opacity-50">
                ✦ AI EXTRACTS THE STRUCTURE
              </span>
              <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums">
                {text.length}/600
              </span>
            </div>
          </div>

          {error && (
            <p className="mono text-[11px] opacity-80 mt-4">{error}</p>
          )}

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <button
              onClick={go}
              disabled={busy}
              className="btn"
            >
              {busy ? "BUILDING…" : "✦ BUILD IT OUT →"}
            </button>
            <button
              onClick={() => onProceed(null)}
              disabled={busy}
              className="mono text-[11px] tracking-widest opacity-70 hover:opacity-100"
            >
              Or start blank →
            </button>
            <button
              onClick={onClose}
              disabled={busy}
              className="mono text-[11px] tracking-widest opacity-50 hover:opacity-100 ml-auto"
            >
              ← CANCEL
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
