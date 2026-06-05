"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import type { Contribution } from "@/lib/types";

/**
 * Help Needed — specific asks the input generated. Each ask is a slot
 * one visitor can claim with "Ich übernehm das". One claim per ask
 * (case-insensitive). When taken, the slot shows the claimer.
 */
export function PrimitiveHelpNeeded({
  spaceId,
  primitiveIndex,
  asks,
  contributions,
  onChanged,
}: {
  spaceId: string;
  primitiveIndex: number;
  asks: string[];
  contributions: Contribution[];
  onChanged: () => void;
}) {
  const { user } = useUser();
  const claims = contributions.filter((c) => c.kind === "claim");
  const [busy, setBusy] = useState<string | null>(null);

  function claimerFor(ask: string): Contribution | null {
    const lc = ask.toLowerCase();
    return claims.find((c) => c.data.kind === "claim" && c.data.ask.toLowerCase() === lc) || null;
  }

  async function claim(ask: string) {
    if (busy) return;
    setBusy(ask);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/contributions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primitiveIndex,
          kind: "claim",
          data: { ask },
        }),
      });
      if (res.ok) onChanged();
    } finally {
      setBusy(null);
    }
  }

  const taken = asks.filter((a) => !!claimerFor(a)).length;

  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70 flex justify-between">
        <span>WO HILFE GUT TÄTE</span>
        <span className="tabular-nums">{taken}/{asks.length}</span>
      </div>
      <ul className="divide-y divide-rule">
        {asks.map((ask, i) => {
          const taker = claimerFor(ask);
          const isMine = !!taker && !!user && taker.userId === user.id;
          return (
            <li key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] leading-snug">{ask}</div>
                {taker && (
                  <div className="mono text-[10px] tracking-widest opacity-70 mt-0.5">
                    @{taker.user.displayName}
                    {isMine && <span className="opacity-80"> · DU</span>}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {taker ? (
                  <span className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-rule-strong opacity-70">
                    ÜBERNOMMEN
                  </span>
                ) : (
                  <>
                    <SignedIn>
                      <button
                        onClick={() => claim(ask)}
                        disabled={busy !== null}
                        className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
                      >
                        {busy === ask ? "…" : "ICH MACH'S →"}
                      </button>
                    </SignedIn>
                    <SignedOut>
                      <SignInButton mode="modal">
                        <button className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
                          ICH MACH'S →
                        </button>
                      </SignInButton>
                    </SignedOut>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
