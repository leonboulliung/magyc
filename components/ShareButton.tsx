"use client";

import { useState } from "react";
import type { Space } from "@/lib/types";

/**
 * Share — native Web Share API on devices that have it (most mobile
 * browsers), fallback to clipboard. Either way, the URL of this space
 * lands somewhere the user can paste it into their existing channels.
 *
 * No platform-side broadcast. The user controls the distribution.
 */
export function ShareButton({
  space,
  variant = "pill",
}: {
  space: Space;
  variant?: "pill" | "text";
}) {
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/s/${space.id}`
      : `/s/${space.id}`;
    const title = space.title || "Eine Umgebung";
    try {
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        try {
          await nav.share({ title, url });
          setHint("GETEILT ✓");
        } catch {
          // user cancelled — no hint
        }
      } else if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        setHint("LINK KOPIERT ✓");
      } else {
        // Last resort: prompt
        if (typeof window !== "undefined") window.prompt("Link", url);
      }
    } finally {
      setBusy(false);
      if (hint || true) {
        window.setTimeout(() => setHint(""), 2200);
      }
    }
  }

  if (variant === "text") {
    return (
      <div className="flex items-center gap-2">
        {hint && <span className="mono text-[10px] tracking-widest opacity-70">{hint}</span>}
        <button
          onClick={go}
          disabled={busy}
          className="mono text-[11px] tracking-widest hover:underline"
        >
          ↗ TEILEN
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {hint && <span className="mono text-[10px] tracking-widest opacity-70 hidden sm:inline">{hint}</span>}
      <button
        onClick={go}
        disabled={busy}
        className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
      >
        ↗ TEILEN
      </button>
    </div>
  );
}
