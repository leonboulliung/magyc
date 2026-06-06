"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";

/**
 * Home — single white page. One textarea. The AI builds a workspace.
 * No sign-in required; anonymous-by-default. The browser holds the
 * owner token for the space the creator just made.
 */
export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: trimmed,
          anonToken: getAnonToken(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "failed");
        return;
      }
      if (json.anonOwnerToken) {
        rememberSpaceOwnerToken(json.id, json.anonOwnerToken);
      }
      router.push(`/s/${json.id}`);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={1200}
            placeholder="…"
            className="w-full text-[20px] sm:text-[24px] leading-relaxed p-4 bg-transparent border-0 outline-none resize-none placeholder:text-black/30"
            disabled={busy}
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="mono text-[10px] tracking-widest opacity-40">
              {text.length > 0 ? `${text.length}/1200` : ""}
            </span>
            <button
              onClick={go}
              disabled={busy || text.trim().length < 3}
              className="mono text-[11px] tracking-widest px-4 py-2 rounded-full bg-black text-white disabled:opacity-30 transition-opacity"
            >
              {busy ? "…" : "→"}
            </button>
          </div>
          {error && (
            <p className="mono text-[10px] tracking-widest opacity-60 mt-4">{error}</p>
          )}
        </div>
      </section>
      <footer className="px-6 py-3 mono text-[9px] tracking-widest opacity-30 text-center">
        CREATOR
      </footer>
    </main>
  );
}
