"use client";

import { useState, useRef, type FormEvent } from "react";
import type { CardDraft } from "./CardCreate";

interface Props {
  initialKind: "idea" | "thing";
  /** Proceed to the composer of `kind`, optionally pre-filled by the AI draft. */
  onProceed: (kind: "idea" | "thing", draft: CardDraft | null) => void;
  onClose: () => void;
  /** Back to the form the user came from, without touching any state. */
  onCancel?: () => void;
}

/**
 * The single create screen. As minimal as it gets: one sentence, a switch for
 * IDEA / THING, and proceed. The AI reads the sentence and pre-fills the next
 * step — but the user's switch decides which kind it becomes, so there's no
 * ambiguity and no platform copy to wade through.
 */
export function PromptStep({ initialKind, onProceed, onClose, onCancel }: Props) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"idea" | "thing">(initialKind);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function proceed(e?: FormEvent) {
    e?.preventDefault();
    const text = prompt.trim();
    // Empty / very short → just open a blank composer of the chosen kind.
    if (text.length < 8) {
      onProceed(kind, null);
      return;
    }
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/cards/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        // AI unavailable / rate-limited → still let them proceed manually,
        // carrying the raw sentence as the title so nothing is lost.
        if (json?.error === "rate_limited") {
          setError(`One moment — try again in ${json.retryInSeconds || 30}s.`);
          return;
        }
        onProceed(kind, { kind, title: text.slice(0, 80) });
        return;
      }
      // The user's switch wins over the model's kind guess.
      onProceed(kind, { ...(json.draft as CardDraft), kind });
    } catch {
      onProceed(kind, { kind, title: text.slice(0, 80) });
    } finally {
      setDrafting(false);
    }
  }

  const isIdea = kind === "idea";

  return (
    <div className="h-full w-full flex flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-rule-strong px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top">
        <div className="mono text-[10px] tracking-widest opacity-70">CREATE · ✦ AI HELP</div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button onClick={onCancel} className="mono text-[11px] tracking-widest hover:underline">
              ← BACK
            </button>
          )}
          <button onClick={onClose} className="mono text-[11px] tracking-widest hover:underline">
            CLOSE ✕
          </button>
        </div>
      </div>

      <form
        onSubmit={proceed}
        className="flex-1 flex flex-col items-stretch justify-center min-h-0 overflow-y-auto"
      >
        <div className="max-w-[680px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-5">
          <textarea
            ref={textareaRef}
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") proceed();
            }}
            placeholder={isIdea ? "Wouldn't it be great if…" : "I want to…"}
            rows={4}
            maxLength={500}
            className="w-full border border-rule-strong bg-white px-4 py-3 editorial text-[22px] sm:text-[28px] leading-[1.2] focus:outline-none focus:ring-2 focus:ring-ink resize-none"
          />

          <div className="flex items-center gap-3">
            {/* IDEA / THING switch */}
            <div className="flex border border-rule-strong mono text-[11px] tracking-widest">
              <button
                type="button"
                onClick={() => setKind("idea")}
                className={`px-4 py-2.5 ${isIdea ? "bg-ink text-paper" : "bg-paper hover:bg-ink/[0.04]"}`}
                aria-pressed={isIdea}
              >
                IDEA
              </button>
              <button
                type="button"
                onClick={() => setKind("thing")}
                className={`px-4 py-2.5 border-l border-rule-strong ${!isIdea ? "bg-ink text-paper" : "bg-paper hover:bg-ink/[0.04]"}`}
                aria-pressed={!isIdea}
              >
                THING
              </button>
            </div>

            <button
              type="submit"
              disabled={drafting}
              className={`btn ml-auto flex items-center gap-2 ${drafting ? "opacity-70" : ""}`}
            >
              {drafting ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-paper animate-pulse" />
                  READING…
                </>
              ) : (
                <>→</>
              )}
            </button>
          </div>

          {error && (
            <div className="mono text-[11px] text-red-700 border-l-2 border-red-700 pl-2">
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
