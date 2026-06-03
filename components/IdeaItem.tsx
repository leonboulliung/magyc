"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import type { Card } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { ResonanceMeter } from "./ResonanceMeter";
import { SignalButton } from "./SignalButton";

/**
 * A single IDEA in the field. Deliberately quieter than a Thing: paper ground,
 * a dashed left edge (open, not yet built), the idea mark, and a resonance
 * meter. The headline is the idea itself; signalling happens inline so the
 * field is where resonance accumulates.
 */
export function IdeaItem({
  card,
  index = 0,
  isFresh = false,
  onChanged,
}: {
  card: Card;
  index?: number;
  isFresh?: boolean;
  onChanged?: () => void;
}) {
  const { user } = useUser();
  const mine = user?.id === card.ownerId;
  const signalled = !!user && card.signals.some((s) => s.userId === user.id);
  const count = card.signals.length;

  return (
    <div
      className={`cp-idea-frame border-b border-rule transition-colors hover:bg-black/[0.02] ${isFresh ? "cp-rise" : ""}`}
    >
      <div className="cp-idea-edge flex items-stretch">
        <div className="flex-1 px-3.5 sm:px-5 py-3 sm:py-3.5 min-w-0">
          {/* meta */}
          <div className="mono text-[10px] tracking-widest flex items-center gap-2 opacity-70">
            <span className="cp-idea-mark" />
            <span>IDEA</span>
            {card.location?.label && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{card.location.label.toUpperCase()}</span>
              </>
            )}
            {isFresh && (
              <span className="shrink-0 mono text-[9px] tracking-widest px-1.5 py-0.5 rounded-full bg-ink text-paper animate-twinkle">
                NEW ✦
              </span>
            )}
            <span className="ml-auto shrink-0">{timeAgo(card.createdAt)}</span>
          </div>

          {/* headline links to the full idea page */}
          <Link href={`/post/${card.id}`} className="group block focus:outline-none">
            <h2 className="editorial font-black text-[22px] sm:text-[26px] mt-1.5 leading-[0.95] break-words group-hover:underline decoration-2 underline-offset-4">
              {card.title}
            </h2>
          </Link>

          {card.tags && card.tags.length > 0 && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {card.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="mono text-[9px] tracking-widest px-2 py-0.5 rounded-full border border-rule-strong text-ink-soft"
                >
                  #{t.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {/* resonance + signal */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <ResonanceMeter count={count} />
            <span className="mono text-[10px] tracking-widest tabular-nums opacity-70">
              {count === 0
                ? "NO SIGNALS YET"
                : `${count} WANT${count > 1 ? "" : "S"} THIS REAL`}
            </span>
            <div className="ml-auto">
              {mine ? (
                <Link
                  href={`/post/${card.id}`}
                  className="mono text-[10px] tracking-widest px-3.5 py-2 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition inline-flex items-center cp-ready"
                >
                  MAKE IT REAL →
                </Link>
              ) : (
                <SignalButton
                  cardId={card.id}
                  signalled={signalled}
                  onChanged={onChanged}
                  size="sm"
                />
              )}
            </div>
          </div>

          <div className="mt-2 mono text-[10px] opacity-60 truncate">
            @{card.owner.displayName}
          </div>
        </div>
      </div>
    </div>
  );
}
