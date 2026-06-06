"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import type { Contribution } from "@/lib/types";
import { useStrings, useLocale } from "@/components/UIStringsProvider";

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
  const t = useStrings();
  const locale = useLocale();

  async function submit() {
    if (busy) return;
    const v = text.trim();
    if (v.length < 1) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/contributions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primitiveIndex, kind: "voice", data: { text: v } }),
      });
      if (res.ok) {
        setText("");
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  const voicePlaceholder = user
    ? t.primitives.voicesPlaceholder.replace("{username}", user.username ?? "…")
    : t.primitives.voicesPlaceholderAnon;

  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70 flex justify-between">
        <span>{t.primitives.voicesLabel}</span>
        <span className="tabular-nums">{voices.length}</span>
      </div>
      {voices.length === 0 ? (
        <div className="px-4 py-3 mono text-[11px] opacity-50">
          {t.primitives.voicesEmpty}
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {voices.map((v) => (
            <li key={v.id} className="px-4 py-3">
              <div className="mono text-[10px] tracking-widest opacity-60 mb-1">
                <span>@{v.user.displayName}</span>
                <span className="opacity-60">
                  {" · "}
                  {new Date(v.createdAt).toLocaleDateString(locale, {
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
            placeholder={voicePlaceholder}
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
              {busy ? "…" : t.primitives.voicesPost}
            </button>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full mono text-[10px] tracking-widest px-3 py-2 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
              {t.primitives.voicesSignIn}
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </section>
  );
}
