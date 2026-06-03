"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Toggle to block / unblock another profile. The blocker stops seeing
 * the blocked user's cards in the field. One-directional — symmetric
 * blocking would be heavier and we let the admin queue handle the rest.
 */
export function BlockButton({
  targetUserId,
  displayName,
  className,
}: {
  targetUserId: string;
  displayName: string;
  className?: string;
}) {
  const { user, isLoaded } = useUser();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (user.id === targetUserId) return;
    let abandoned = false;
    fetch("/api/blocks")
      .then((r) => r.json())
      .then((j) => {
        if (abandoned) return;
        const list: string[] = Array.isArray(j?.blocked) ? j.blocked : [];
        setBlocked(list.includes(targetUserId));
      })
      .catch(() => setBlocked(false));
    return () => {
      abandoned = true;
    };
  }, [isLoaded, user, targetUserId]);

  if (!isLoaded || !user) return null;
  if (user.id === targetUserId) return null;
  if (blocked === null) return null; // wait for fetch

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (blocked) {
        await fetch(`/api/blocks/${targetUserId}`, { method: "DELETE" });
        setBlocked(false);
      } else {
        if (!confirm(`Block @${displayName}? Their cards stop showing for you.`)) {
          return;
        }
        await fetch("/api/blocks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: targetUserId }),
        });
        setBlocked(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={
        className ||
        "mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
      }
      aria-label={blocked ? "Unblock" : "Block"}
    >
      {busy ? "…" : blocked ? "UNBLOCK" : "BLOCK"}
    </button>
  );
}
