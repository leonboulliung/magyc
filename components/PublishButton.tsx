"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const L = space.labels;

  if (space.visibility !== null) return null;
  const ownerToken = getSpaceOwnerToken(space.id);
  if (!ownerToken) return null;
  const signedOut = !user;
  const isAnonymousDraft = !space.owner;
  const claimIntentKey = `magyc.claim_after_signin.${space.id}`;

  function friendlyError(code: unknown): string {
    if (code === "owner_token_required" || code === "owner_token_mismatch") {
      return "Dieser Entwurf kann in diesem Browser nicht mehr eindeutig zugeordnet werden.";
    }
    if (code === "already_published") return "Dieses Projekt wurde bereits veröffentlicht.";
    if (code === "claim_failed") return "Das Projekt konnte gerade nicht im Studio gespeichert werden.";
    if (code === "unauthorized") return "Bitte melde dich an, um das Projekt zu speichern.";
    return "Die Aktion konnte gerade nicht abgeschlossen werden.";
  }

  async function saveToStudio() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${space.id}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anonOwnerToken: ownerToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(json?.error));
        return;
      }
      setOpen(false);
      router.push(json?.redirectTo || `/studio/${space.id}`);
    } finally {
      setBusy(false);
    }
  }

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
        setError(friendlyError(json?.error));
        return;
      }
      setOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user || !isAnonymousDraft || !ownerToken || busy) return;
    if (window.sessionStorage.getItem(claimIntentKey) !== "1") return;
    window.sessionStorage.removeItem(claimIntentKey);
    void saveToStudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAnonymousDraft, ownerToken, claimIntentKey, busy]);

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
        {signedOut || isAnonymousDraft ? "Im Studio speichern" : label(L, "publishCta")}
      </button>

      <Dialog open={open} onOpenChange={setOpen} maxWidth={448} title={label(L, "publishTitle")}>
        <div className="w-full bg-white text-black p-6 rounded-[var(--v-radius)] space-y-5">
            <div className="space-y-1.5">
              <h2 className="font-black text-[22px] leading-snug">
                {signedOut || isAnonymousDraft ? "Projekt im Studio speichern" : label(L, "publishTitle")}
              </h2>
              {signedOut || isAnonymousDraft ? (
                <p className="text-[13px] opacity-70 leading-relaxed">
                  Melde dich an, um diesen Entwurf als privates Studio-Projekt zu übernehmen. Danach kannst du Planung, Auswahl und Übergabe weiterführen.
                </p>
              ) : label(L, "publishExplanation") && (
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
                  onClick={isAnonymousDraft ? saveToStudio : publish}
                  disabled={busy}
                  className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30"
                >
                  {busy ? "…" : isAnonymousDraft ? "Im Studio öffnen" : label(L, "publishConfirm")}
                </button>
              </div>
            </SignedIn>

            <SignedOut>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-[11px] tracking-widest opacity-60 hover:opacity-100"
                >
                  {label(L, "cancel")}
                </button>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={`/s/${space.id}`}
                  fallbackRedirectUrl={`/s/${space.id}`}
                  signUpForceRedirectUrl={`/s/${space.id}`}
                  signUpFallbackRedirectUrl={`/s/${space.id}`}
                >
                  <button
                    onClick={() => window.sessionStorage.setItem(claimIntentKey, "1")}
                    className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white"
                  >
                    Anmelden / Account anlegen
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
        </div>
      </Dialog>
    </>
  );
}
