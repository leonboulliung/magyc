"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readApiJson, showApiError, showUnknownError } from "@/lib/client/feedback";
import { cleanProfile, type StudioProfile } from "@/lib/studioProfile";
import { useT } from "@/components/i18n/LocaleProvider";

export type SaveStatus = "loading" | "saving" | "saved" | "error";

/**
 * Loads the account profile + settings once and persists changes with a short
 * debounce. Shared by the Profil and Einstellungen pages so both edit the same
 * record with identical save semantics.
 */
export function useStudioProfile() {
  const t = useT();
  const [profile, setProfile] = useState<StudioProfile | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/studio/profile", { cache: "no-store" });
        const json = await readApiJson(res);
        if (!res.ok || !json?.profile) throw new Error("profile_failed");
        if (!cancelled) {
          setProfile(cleanProfile(json.profile));
          setStatus("saved");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          showUnknownError(t.messages.profileNotLoaded, error, {
            fallback: t.messages.tryLater,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [t.messages.profileNotLoaded, t.messages.tryLater]);

  const persist = useCallback(async (next: StudioProfile) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/studio/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: next.displayName,
          headline: next.headline,
          bio: next.bio,
          avatarUrl: next.avatarUrl,
          specialties: next.specialties,
          settings: next.settings,
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        setStatus("error");
        showApiError(t.messages.notSaved, json, { fallback: t.messages.changeSaveFailed });
        return;
      }
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      showUnknownError(t.messages.notSaved, error, { fallback: t.messages.changeSaveFailed });
    }
  }, [t.messages.changeSaveFailed, t.messages.notSaved]);

  const update = useCallback((patch: Partial<StudioProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(next), 600);
      return next;
    });
  }, [persist]);

  return { profile, status, update };
}
