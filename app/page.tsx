"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

/**
 * Home — a single text input. Type a thought, an idea, a question, a
 * concern, or a plan. The AI builds a small workspace around it; you
 * get a URL to share through whatever channels you already use.
 *
 * No feed. No discovery. The app's only job is to turn a little input
 * into a shareable artifact.
 */
export default function HomePage() {
  const router = useRouter();
  const { user } = useUser();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError("Schreib einen Satz — was auch immer im Kopf ist.");
      return;
    }
    if (!user) {
      // Shouldn't happen: the button is gated behind <SignedIn>.
      setError("Du musst angemeldet sein.");
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
          setError("Kurz Atem holen — versuch's in ein paar Sekunden nochmal.");
        } else if (json?.error === "ai_not_configured") {
          setError("Der AI-Dienst ist gerade nicht erreichbar.");
        } else {
          setError("Konnte nicht erzeugen.");
        }
        return;
      }
      router.push(`/s/${json.id}`);
    } catch {
      setError("Konnte nicht erzeugen.");
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
                SIGN IN
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-3">
            <div className="mono text-[10px] tracking-widest opacity-60">NEU</div>
            <h1 className="editorial font-black text-[40px] sm:text-[56px] leading-[0.95]">
              Was geht dir gerade durch den Kopf?
            </h1>
            <p className="mono text-[12px] opacity-70 leading-relaxed max-w-xl">
              Ein Gedanke, eine Idee, eine Frage, eine Sorge, ein Plan. Schreib
              es kurz auf — daraus entsteht eine kleine Umgebung, die du teilen
              kannst.
            </p>
          </div>

          <div>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={1200}
              placeholder="z. B. Ich überlege, wie ich diesen Sommer einen kleinen Schreibkreis in meiner Nachbarschaft starten könnte."
              className="w-full text-[18px] leading-relaxed p-4 bg-surface border border-rule-strong rounded-2xl focus:outline-none focus:border-ink resize-none"
              disabled={busy}
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="mono text-[10px] tracking-widest opacity-50">
                ✦ KI BAUT DIE STRUKTUR · KEIN FEED, KEINE FOLLOWER
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
                {busy ? "BAUE…" : "✦ UMGEBUNG ERZEUGEN →"}
              </button>
            </SignedIn>
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="mono text-[11px] tracking-widest px-5 py-2.5 rounded-full bg-ink text-paper hover:opacity-90 transition-opacity">
                  SIGN UP, UM ZU STARTEN →
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      </section>

      <footer className="px-6 py-4 mono text-[10px] tracking-widest opacity-50 border-t border-rule">
        Du erzeugst — die App teilt es nicht für dich. Du gehst raus damit, wenn du fertig bist.
      </footer>
    </main>
  );
}
