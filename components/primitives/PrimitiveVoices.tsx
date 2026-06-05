"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import type { Contribution } from "@/lib/types";

/**
 * Voices — an open slot for visitors to weigh in. Any signed-in user
 * can post a voice; reading is public. Voices accumulate in order of
 * posting (oldest first feels right here — a thread, not a feed).
 */
export function PrimitiveVoices({
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
  const { user } = useUser();
  const voices = contributions
    .filter((c) => c.kind === "voice")
    .sort((a, b) => a.createdAt - b.createdAt);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const t = text.trim();
    if (t.length < 1) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/contributions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primitiveIndex,
          kind: "voice",
          data: { text: t },
        }),
      });
      if (res.ok) {
        setText("");
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70 flex justify-between">
        <span>STIMMEN</span>
        <span className="tabular-nums">{voices.length}</span>
      </div>
      {voices.length === 0 ? (
        <div className="px-4 py-3 mono text-[11px] opacity-50">
          Noch nichts. Sei der/die erste.
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {voices.map((v) => (
            <li key={v.id} className="px-4 py-3">
              <div className="mono text-[10px] tracking-widest opacity-60 mb-1">
                <span>@{v.user.displayName}</span>
                <span className="opacity-60">
                  {" · "}
                  {new Date(v.createdAt).toLocaleDateString(undefined, {
                    day: "2-digit", month: "short",
                  })}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                {v.data.kind === "voice" ? v.data.text : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-rule p-3">
        <SignedIn>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={800}
            placeholder={user ? `Sag was, @${user.username ?? "du"}…` : "Sag was…"}
            className="w-full text-[14px] leading-relaxed p-2.5 bg-paper border border-rule rounded-xl focus:outline-none focus:border-ink resize-none"
            disabled={busy}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums">
              {text.length}/800
            </span>
            <button
              onClick={submit}
              disabled={busy || text.trim().length < 1}
              className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full bg-ink text-paper hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? "…" : "POSTEN →"}
            </button>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full mono text-[10px] tracking-widest px-3 py-2 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
              SIGN IN, UM ZU ANTWORTEN →
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </section>
  );
}
