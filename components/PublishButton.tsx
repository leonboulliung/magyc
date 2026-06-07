"use client";

import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { getSpaceOwnerToken } from "@/lib/anonId";
import type { Space } from "@/lib/types";

/**
 * Publish — shown only to the draft owner. The owner is identified by
 * possession of the `creator.space_owner.<id>` token in localStorage.
 * Publishing requires Clerk sign-in: the publish moment is when the
 * anonymous owner becomes a real account.
 *
 * Once published the button disappears; the space is "live" with v1
 * in the version bar.
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

  // Only show on drafts.
  if (space.visibility !== null) return null;

  // Only show if the browser holds the owner token for this space.
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
        setError(json?.error || "failed");
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
        publish →
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="max-w-md w-full bg-white text-black p-6 rounded-lg space-y-5">
            <div className="space-y-1.5">
              <div className="mono text-[10px] tracking-widest opacity-50">PUBLISH</div>
              <h2 className="font-black text-[22px] leading-snug">
                Den Raum live nehmen
              </h2>
              <p className="text-[13px] opacity-70 leading-relaxed">
                Bis jetzt ist das ein Entwurf, den nur du mit dem Link erreichst.
                Sobald du veröffentlichst, ist der Raum für jeden mit dem Link
                lesbar. Versions-Historie startet ab diesem Moment.
              </p>
            </div>

            <SignedIn>
              <div className="mono text-[10px] tracking-widest opacity-60">
                EINGELOGGT ALS @{user?.username || user?.id.slice(-6) || "—"}
              </div>
              {error && (
                <p className="mono text-[10px] tracking-widest opacity-80">{error}</p>
              )}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-[11px] tracking-widest opacity-60 hover:opacity-100"
                  disabled={busy}
                >
                  abbrechen
                </button>
                <button
                  onClick={publish}
                  disabled={busy}
                  className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30"
                >
                  {busy ? "…" : "veröffentlichen →"}
                </button>
              </div>
            </SignedIn>

            <SignedOut>
              <p className="text-[13px] opacity-70 leading-relaxed">
                Veröffentlichen erfordert eine Anmeldung — der Moment, in dem
                aus deinem anonymen Entwurf eine Sache wird, für die du
                stehst.
              </p>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-[11px] tracking-widest opacity-60 hover:opacity-100"
                >
                  abbrechen
                </button>
                <SignInButton mode="modal">
                  <button className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white">
                    sign in →
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
          </div>
        </div>
      )}
    </>
  );
}
