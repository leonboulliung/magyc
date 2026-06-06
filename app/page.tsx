"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useStrings } from "@/components/UIStringsProvider";

export default function HomePage() {
  const router = useRouter();
  const { user } = useUser();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = useStrings();

  async function generate() {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError(t.home.errorTooShort);
      return;
    }
    if (!user) {
      setError(t.home.errorNotSignedIn);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "rate_limited") {
          setError(t.home.errorRateLimited);
        } else if (json?.error === "ai_not_configured") {
          setError(t.home.errorAiUnavailable);
        } else {
          setError(t.home.errorGenerateFailed);
        }
        return;
      }
      router.push(`/s/${json.id}`);
    } catch {
      setError(t.home.errorGenerateFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-rule">
        <span className="font-black tracking-tightest text-[16px]">CREATOR</span>
        <div className="flex items-center gap-3">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
                {t.home.signIn}
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-3">
            <div className="mono text-[10px] tracking-widest opacity-60">{t.home.new}</div>
            <h1 className="editorial font-black text-[40px] sm:text-[56px] leading-[0.95]">
              {t.home.headline}
            </h1>
            <p className="mono text-[12px] opacity-70 leading-relaxed max-w-xl">
              {t.home.subtitle}
            </p>
          </div>

          <div>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={1200}
              placeholder={t.home.placeholder}
              className="w-full text-[18px] leading-relaxed p-4 bg-surface border border-rule-strong rounded-2xl focus:outline-none focus:border-ink resize-none"
              disabled={busy}
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="mono text-[10px] tracking-widest opacity-50">
                {t.home.tagline}
              </span>
              <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums">
                {text.length}/1200
              </span>
            </div>
          </div>

          {error && (
            <p className="mono text-[11px] opacity-80">{error}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <SignedIn>
              <button
                onClick={generate}
                disabled={busy || text.trim().length < 3}
                className="mono text-[11px] tracking-widest px-5 py-2.5 rounded-full bg-ink text-paper hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {busy ? t.home.generating : t.home.generate}
              </button>
            </SignedIn>
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="mono text-[11px] tracking-widest px-5 py-2.5 rounded-full bg-ink text-paper hover:opacity-90 transition-opacity">
                  {t.home.signUp}
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      </section>

      <footer className="px-6 py-4 mono text-[10px] tracking-widest opacity-50 border-t border-rule">
        {t.home.footer}
      </footer>
    </main>
  );
}
