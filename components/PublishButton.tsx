"use client";

import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { getSpaceOwnerToken } from "@/lib/anonId";
import { label } from "@/lib/labels";
import type { Space } from "@/lib/types";
import { Dialog } from "./ui/Dialog";

/**
 * Publish — shown only to the draft owner. Every visible word reads
 * from the space's AI-generated labels with Unicode-symbol fallbacks.
 * The component imposes no language on the surface.
 */
export function PublishButton({
  space,
  onChanged,
}: {
  space: Space;
  onChanged: () => void;
}) {
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const L = space.labels;

  if (space.visibility !== null) return null;
  const ownerToken = getSpaceOwnerToken(space.id);
  if (!ownerToken) return null;

  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${space.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anonOwnerToken: ownerToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "✕");
        return;
      }
      setOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full transition-colors"
        style={{
          border: "1px solid var(--v-fg)",
          background: "var(--v-fg)",
          color: "var(--v-bg)",
        }}
      >
        {label(L, "publishCta")}
      </button>

      <Dialog open={open} onOpenChange={setOpen} maxWidth={448} title={label(L, "publishTitle")}>
        <div className="w-full bg-white text-black p-6 rounded-lg space-y-5">
            <div className="space-y-1.5">
              <h2 className="font-black text-[22px] leading-snug">
                {label(L, "publishTitle")}
              </h2>
              {label(L, "publishExplanation") && (
                <p className="text-[13px] opacity-70 leading-relaxed">
                  {label(L, "publishExplanation")}
                </p>
              )}
            </div>

            <SignedIn>
              {label(L, "signedInAs") && user && (
                <div className="mono text-[10px] tracking-widest opacity-60">
                  {label(L, "signedInAs")} {user.username || user.id.slice(-6)}
                </div>
              )}
              {error && (
                <p className="mono text-[10px] tracking-widest opacity-80">{error}</p>
              )}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-[11px] tracking-widest opacity-60 hover:opacity-100"
                  disabled={busy}
                >
                  {label(L, "cancel")}
                </button>
                <button
                  onClick={publish}
                  disabled={busy}
                  className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30"
                >
                  {busy ? "…" : label(L, "publishConfirm")}
                </button>
              </div>
            </SignedIn>

            <SignedOut>
              {label(L, "signInPrompt") && (
                <p className="text-[13px] opacity-70 leading-relaxed">
                  {label(L, "signInPrompt")}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-[11px] tracking-widest opacity-60 hover:opacity-100"
                >
                  {label(L, "cancel")}
                </button>
                <SignInButton mode="modal">
                  <button className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white">
                    {label(L, "signInCta")}
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
        </div>
      </Dialog>
    </>
  );
}
