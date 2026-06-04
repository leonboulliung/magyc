"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { fetchField, fetchProfile } from "@/lib/db";
import { useRealtimeCards } from "@/lib/realtime";
import { computeDiscoverTiles, type DiscoverTile } from "@/lib/discover";
import { placeKindLabel } from "@/lib/placeKind";
import { cardColor } from "@/lib/color";
import { KlarheitChip } from "@/components/KlarheitBar";
import type { Card } from "@/lib/types";
import { fullStartLabel, parisClockLabel, timeAgo } from "@/lib/time";

/**
 * Discover — relationships in the field, surfaced as tiles. Every tile
 * is derivative: time-to-event, joiner recency, signals, quartier
 * counts, tag overlap with the viewer's interests. No AI, no extra
 * inputs from the user. The field already knows these things; this
 * page just makes them legible.
 */
export function DiscoverView() {
  const { user, isLoaded } = useUser();
  const [things, setThings] = useState<Card[]>([]);
  const [ideas, setIdeas] = useState<Card[]>([]);
  const [viewerTags, setViewerTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetchField()
      .then(({ ideas: nextIdeas, things: nextThings }) => {
        setIdeas(nextIdeas);
        setThings(nextThings);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);
  useRealtimeCards(refresh);

  // Viewer's interests, used for the "matching your tags" tile.
  useEffect(() => {
    if (!user?.id) {
      setViewerTags([]);
      return;
    }
    fetchProfile(user.id)
      .then((p) => setViewerTags(p?.interests ?? []))
      .catch(() => setViewerTags([]));
  }, [user?.id]);

  const tiles = computeDiscoverTiles(things, ideas, viewerTags);

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain animate-fadeIn">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-10">
          <div className="space-y-3 border-b border-rule pb-6">
            <div className="mono text-[10px] tracking-widest opacity-60">DISCOVER</div>
            <h1 className="editorial font-black text-[40px] sm:text-[56px] leading-[0.95]">
              The field at a glance.
            </h1>
            <p className="mono text-[12px] opacity-70 leading-relaxed max-w-xl">
              What&rsquo;s about to happen. Who&rsquo;s gathering. Which
              quartier is moving. What lines up with what you already
              care about.
            </p>
            <Link href="/" className="mono text-[11px] tracking-widest hover:underline inline-block">
              ← BACK TO PARIS
            </Link>
          </div>

          {!loaded ? (
            <div className="mono text-[11px] opacity-60 py-10 text-center">LOADING…</div>
          ) : tiles.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="editorial font-black text-[26px]">Quiet right now.</p>
              <p className="mono text-[11px] opacity-60">
                No active things, no resonating ideas. Try posting one.
              </p>
              <Link href="/" className="btn inline-block mt-3">＋ POST ONE THING</Link>
            </div>
          ) : (
            <div className="space-y-12">
              {tiles.map((t, i) => (
                <TileSection key={i} tile={t} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function TileSection({ tile }: { tile: DiscoverTile }) {
  const meta = headerFor(tile);
  return (
    <section className="space-y-4">
      <div className="border-b border-rule pb-2">
        <div className="mono text-[10px] tracking-widest opacity-60">{meta.kicker}</div>
        <h2 className="editorial font-black text-[26px] sm:text-[32px] leading-none mt-1">
          {meta.headline}
        </h2>
        {meta.sub && (
          <p className="mono text-[11px] opacity-70 mt-1.5">{meta.sub}</p>
        )}
      </div>
      <ul className="divide-y divide-rule">
        {tile.cards.map((c) => (
          <li key={c.id}>
            <CardRow card={c} tile={tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function headerFor(t: DiscoverTile): { kicker: string; headline: string; sub?: string } {
  switch (t.kind) {
    case "imminent":
      return {
        kicker: "IMMINENT · STARTING SOON",
        headline: "Within the next 90 minutes.",
      };
    case "tonight":
      return {
        kicker: "TONIGHT · NEXT 12 HOURS",
        headline: "What's on next.",
      };
    case "crew_forming":
      return {
        kicker: "CREW FORMING · LAST 24H",
        headline: "People are stepping in.",
      };
    case "resonating":
      return {
        kicker: "RESONATING · IDEAS WANTING TO BE MADE REAL",
        headline: "What the field wants.",
      };
    case "quartier_cluster":
      return {
        kicker: "QUARTIER · " + t.quartier.toUpperCase(),
        headline: `${t.quartier} is moving.`,
        sub: `${t.cards.length} active things grouped here.`,
      };
    case "your_tags":
      return {
        kicker: "MATCHING YOUR INTERESTS",
        headline: "Lines up with what you care about.",
        sub: t.tags.map((tag) => "#" + tag).join("  ·  "),
      };
  }
}

function CardRow({ card, tile }: { card: Card; tile: DiscoverTile }) {
  const color = cardColor(card);
  const isIdea = card.kind === "idea";
  const placeKind = placeKindLabel(card.locationKind);

  // Highlight the most meaningful metric per tile-kind.
  const accent = ((): string => {
    switch (tile.kind) {
      case "imminent":
      case "tonight":
        return card.expiresAt ? fullStartLabel(card.expiresAt) : "—";
      case "crew_forming":
        return `${card.joiners.length}/${card.spots ?? "—"} PEOPLE · ${freshestJoinerAge(card)}`;
      case "resonating":
        return `${card.signals.length} ${card.signals.length === 1 ? "SIGNAL" : "SIGNALS"}`;
      case "quartier_cluster":
        return card.expiresAt
          ? `${parisClockLabel(card.expiresAt)} · ${placeKind ?? "PARIS"}`
          : placeKind ?? "IDEA";
      case "your_tags":
        return card.expiresAt
          ? fullStartLabel(card.expiresAt)
          : `${card.signals.length} ${card.signals.length === 1 ? "SIGNAL" : "SIGNALS"}`;
    }
  })();

  return (
    <Link
      href={`/post/${card.id}`}
      className="block py-4 group focus:outline-none transition-colors hover:bg-black/[0.02]"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="mono text-[10px] tracking-widest opacity-60 flex items-center gap-1.5 flex-wrap">
            <span>{isIdea ? "IDEA" : "THING"}</span>
            <span className="opacity-40">·</span>
            <span className="truncate">{accent}</span>
          </div>
          <div className="editorial font-black text-[20px] sm:text-[24px] leading-[1.05] mt-1 break-words group-hover:underline decoration-2 underline-offset-4">
            {card.title}
          </div>
          <div className="mono text-[10px] opacity-60 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span>@{card.owner.displayName}</span>
            {card.location?.label && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{card.location.label}</span>
              </>
            )}
            {placeKind && tile.kind !== "quartier_cluster" && (
              <>
                <span className="opacity-40">·</span>
                <span>{placeKind}</span>
              </>
            )}
            {!isIdea && (
              <>
                <span className="opacity-40">·</span>
                <KlarheitChip card={card} />
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function freshestJoinerAge(c: Card): string {
  if (c.joiners.length === 0) return "JUST CREW";
  const newest = c.joiners.reduce((m, j) => Math.max(m, j.joinedAt), 0);
  return `JOINED ${timeAgo(newest)} AGO`;
}
