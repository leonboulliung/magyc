"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import type { Card } from "@/lib/types";
import { timeAgo, expiresIn } from "@/lib/time";
import { cardColor, isDark } from "@/lib/color";

export function CardItem({
  card,
  index = 0,
  isFresh = false,
}: {
  card: Card;
  index?: number;
  /** When true, the row gets a brief "NEW ✦" badge and a soft entrance. */
  isFresh?: boolean;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const color = cardColor(card);
  const dark = isDark(color);
  const { user } = useUser();
  const mine = user?.id === card.ownerId;
  // First tag headlines the swatch. Falls back to "CARD" — generic but
  // honest now that we no longer split idea/thing.
  const headlineTag = card.tags?.[0]?.toUpperCase() || "CARD";
  const joinedCount = card.members.filter((m) => m.state === "joined").length;
  const requestCount = card.members.filter((m) => m.state === "requested").length;

  return (
    <Link
      href={`/post/${card.id}`}
      className={`block border-b border-rule group focus:outline-none transition-colors hover:bg-black/[0.025] ${isFresh ? "cp-fresh-row animate-fadeIn" : ""}`}
    >
      <div className="flex items-stretch gap-0">
        <div
          className="relative w-20 sm:w-24 shrink-0 overflow-hidden transition-transform duration-300 group-hover:scale-[1.015]"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          <div
            className={`absolute left-2 top-2 mono text-[9px] tracking-widest px-2 py-0.5 rounded-full max-w-[calc(100%-16px)] truncate ${dark ? "bg-white/90 text-ink" : "bg-ink/90 text-paper"}`}
          >
            {headlineTag}
          </div>
        </div>

        <div className="flex-1 px-3.5 sm:px-5 py-3 sm:py-3.5 min-w-0">
          <div className="mono text-[10px] tracking-widest flex items-center gap-2 opacity-70">
            <span className="tabular-nums">#{String(index + 1).padStart(3, "0")}</span>
            <span>·</span>
            <span className="truncate">{(card.location?.label || "OPEN").toUpperCase()}</span>
            {isFresh && (
              <span className="shrink-0 mono text-[9px] tracking-widest px-1.5 py-0.5 rounded-full bg-ink text-paper animate-twinkle">
                NEW ✦
              </span>
            )}
            <span className="ml-auto shrink-0">{timeAgo(card.createdAt)}</span>
          </div>

          <h2 className="editorial font-black text-[22px] sm:text-[26px] mt-1.5 leading-[0.95] break-words group-hover:underline decoration-2 underline-offset-4">
            {card.title}
          </h2>

          {card.tags && card.tags.length > 1 && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {card.tags.slice(1, 4).map((t) => (
                <span
                  key={t}
                  className="mono text-[9px] tracking-widest px-2 py-0.5 rounded-full border border-rule-strong text-ink-soft"
                >
                  #{t.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 mono text-[11px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag">
                {card.permission === "request" ? "REQUEST" : "PUBLIC JOIN"}
              </span>
              <span className="tabular-nums">
                {joinedCount}/{card.spots ?? "—"} PEOPLE
              </span>
              {card.startsAt && (
                <span className="tabular-nums opacity-70">
                  · {expiresIn(card.startsAt).toUpperCase()}
                </span>
              )}
              {requestCount > 0 && mine && (
                <span className="tabular-nums opacity-70">
                  · {requestCount} REQUEST{requestCount > 1 ? "S" : ""}
                </span>
              )}
            </div>
            <div className="opacity-70 truncate mt-1">
              @{card.owner.displayName}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
