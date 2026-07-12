"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/LocaleProvider";
import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { getSpaceOwnerToken } from "@/lib/anonId";
import { label } from "@/lib/labels";
import {
  readApiJson,
  showActionLoading,
  showActionSuccess,
  showActionError,
} from "@/lib/client/feedback";
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
  const searchParams = useSearchParams();
  const { user } = useUser();
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const L = space.labels;
  const ownerToken = space.visibility === null ? getSpaceOwnerToken(space.id) : null;
  const signedOut = !user;
  const isAnonymousDraft = !space.owner;
  const isStudioProject = !!space.owner && space.stage !== null;
  const claimIntentKey = `magyc.claim_after_signin.${space.id}`;
  const claimRequested = searchParams.get("claim") === "1";
  const claimRedirectUrl = `/s/${space.id}?claim=1`;

  function friendlyError(code: unknown): string {
    if (code === "owner_token_required" || code === "owner_token_mismatch") {
      return tr.studio.draftUnassignable;
    }
    if (code === "already_published") return tr.studio.alreadyPublished;
    if (code === "claim_failed") return tr.studio.claimFailed;
    if (code === "publish_failed") return tr.studio.publishFailedMsg;
    if (code === "unauthorized") return tr.studio.signInToSave;
    return tr.studio.actionFailed;
  }

  async function saveToStudio() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      showActionLoading(tr.studio.savingToStudio, `claim-${space.id}`);
      const res = await fetch(`/api/spaces/${space.id}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anonOwnerToken: ownerToken }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        const message = friendlyError(json?.error);
        setError(message);
        showActionError(tr.studio.saveFailedTitle, {
          id: `claim-${space.id}`,
          description: message,
        });
        return;
      }
      showActionSuccess(tr.studio.projectSaved, {
        id: `claim-${space.id}`,
        description: tr.studio.redirectingToStudio,
      });
      setOpen(false);
      router.push(typeof json.redirectTo === "string" ? json.redirectTo : `/project/${space.id}`);
    } catch {
      const message = tr.studio.networkError;
      setError(message);
      showActionError(tr.studio.saveFailedTitle, {
        id: `claim-${space.id}`,
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      showActionLoading(tr.studio.publishing, `publish-${space.id}`);
      const res = await fetch(`/api/spaces/${space.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anonOwnerToken: ownerToken }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        const message = friendlyError(json?.error);
        setError(message);
        showActionError(tr.studio.publishFailedTitle, {
          id: `publish-${space.id}`,
          description: message,
        });
        return;
      }
      showActionSuccess(tr.studio.projectPublished, { id: `publish-${space.id}` });
      setOpen(false);
      onChanged();
    } catch {
      const message = tr.studio.networkError;
      setError(message);
      showActionError(tr.studio.publishFailedTitle, {
        id: `publish-${space.id}`,
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user || !isAnonymousDraft || !ownerToken || busy) return;
    if (!claimRequested && window.sessionStorage.getItem(claimIntentKey) !== "1") return;
    window.sessionStorage.removeItem(claimIntentKey);
    void saveToStudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAnonymousDraft, ownerToken, claimIntentKey, claimRequested, busy]);

  if (space.visibility !== null || isStudioProject || !ownerToken) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mono flex h-7 items-center rounded-full px-3 text-[10px] tracking-widest transition-colors"
        style={{
          border: "1px solid var(--v-fg)",
          background: "var(--v-fg)",
          color: "var(--v-bg)",
        }}
      >
        {signedOut || isAnonymousDraft ? tr.studio.saveToStudio : label(L, "publishCta")}
      </button>

      <Dialog open={open} onOpenChange={setOpen} maxWidth={448} title={label(L, "publishTitle")}>
        <div className="w-full bg-white text-black p-6 rounded-[var(--v-radius)] space-y-5">
            <div className="space-y-1.5">
              <h2 className="font-black text-[22px] leading-snug">
                {signedOut || isAnonymousDraft ? tr.studio.saveProjectToStudio : label(L, "publishTitle")}
              </h2>
              {signedOut || isAnonymousDraft ? (
                <p className="text-[13px] opacity-70 leading-relaxed">
                  {tr.studio.saveDraftToStudioBody}
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
                <div
                  role="alert"
                  className="rounded-2xl border border-red-950/15 bg-red-950/[0.06] px-3 py-2 text-[13px] leading-relaxed text-red-950/80"
                >
                  {error}
                </div>
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
                  {busy ? "…" : isAnonymousDraft ? tr.studio.openInStudio : label(L, "publishConfirm")}
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
                  forceRedirectUrl={claimRedirectUrl}
                  fallbackRedirectUrl={claimRedirectUrl}
                  signUpForceRedirectUrl={claimRedirectUrl}
                  signUpFallbackRedirectUrl={claimRedirectUrl}
                >
                  <button
                    onClick={() => window.sessionStorage.setItem(claimIntentKey, "1")}
                    className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white"
                  >
                    {tr.studio.signInOrCreateAccount}
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
        </div>
      </Dialog>
    </>
  );
}
