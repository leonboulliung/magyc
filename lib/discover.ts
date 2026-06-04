import type { Card } from "./types";

/**
 * Discover surface — purely derivative. Every tile reads from the
 * relationships already present in the data: time-to-event, joiner
 * recency, signal accumulation, quartier counts, tag overlap with
 * the viewer's interests. No AI, no extra inputs.
 */

export type DiscoverTile =
  | { kind: "tonight"; cards: Card[] }
  | { kind: "imminent"; cards: Card[] }
  | { kind: "resonating"; cards: Card[] }
  | { kind: "crew_forming"; cards: Card[] }
  | { kind: "quartier_cluster"; quartier: string; cards: Card[] }
  | { kind: "your_tags"; tags: string[]; cards: Card[] };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Strip the area suffix off a label so "Le Marais · Paris" groups
 *  with "Le Marais". */
function bareQuartier(label: string | undefined): string | null {
  if (!label) return null;
  const head = label.split("·")[0]?.trim();
  return head || null;
}

export function computeDiscoverTiles(
  things: Card[],
  ideas: Card[],
  viewerTags: string[] = [],
): DiscoverTile[] {
  const tiles: DiscoverTile[] = [];
  const now = Date.now();

  // ── Imminent (< 90 min to start). Highest urgency band. ──
  const imminent = things
    .filter((c) => c.expiresAt && c.expiresAt > now && c.expiresAt - now <= 90 * 60_000)
    .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0))
    .slice(0, 4);
  if (imminent.length) tiles.push({ kind: "imminent", cards: imminent });

  // ── Tonight (≤ 12h to start). The "what's on" band. ──
  const tonight = things
    .filter((c) => {
      if (!c.expiresAt || c.expiresAt <= now) return false;
      if (imminent.some((m) => m.id === c.id)) return false;
      return c.expiresAt - now <= 12 * HOUR;
    })
    .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0))
    .slice(0, 6);
  if (tonight.length) tiles.push({ kind: "tonight", cards: tonight });

  // ── Crew forming: someone joined in the last 24h. ──
  const crewForming = things
    .filter((c) => c.joiners.some((j) => now - j.joinedAt <= DAY))
    .filter((c) => !imminent.some((m) => m.id === c.id))
    .filter((c) => !tonight.some((m) => m.id === c.id))
    .sort((a, b) => b.joiners.length - a.joiners.length)
    .slice(0, 4);
  if (crewForming.length) tiles.push({ kind: "crew_forming", cards: crewForming });

  // ── Resonating: ideas with the most signals (>= 2). ──
  const resonating = ideas
    .filter((i) => i.signals.length >= 2)
    .sort((a, b) => b.signals.length - a.signals.length)
    .slice(0, 4);
  if (resonating.length) tiles.push({ kind: "resonating", cards: resonating });

  // ── Quartier clusters: 3+ active things in the same quartier head. ──
  const byQuartier = new Map<string, Card[]>();
  for (const c of things) {
    const q = bareQuartier(c.location?.label);
    if (!q) continue;
    const arr = byQuartier.get(q) ?? [];
    arr.push(c);
    byQuartier.set(q, arr);
  }
  const clusters = [...byQuartier.entries()]
    .filter(([, list]) => list.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);
  for (const [q, list] of clusters) {
    tiles.push({ kind: "quartier_cluster", quartier: q, cards: list.slice(0, 6) });
  }

  // ── Your tags: things tagged with anything in the viewer's interests. ──
  if (viewerTags.length > 0) {
    const wantSet = new Set(viewerTags.map((t) => t.toLowerCase()));
    const matchTags = (c: Card): string[] =>
      c.tags.filter((t) => wantSet.has(t.toLowerCase()));
    const hits = things
      .map((c) => ({ c, m: matchTags(c) }))
      .filter((x) => x.m.length > 0);
    if (hits.length) {
      // The tile lists the overlapping tags it found.
      const tagsSeen = new Set<string>();
      for (const { m } of hits) for (const t of m) tagsSeen.add(t.toLowerCase());
      tiles.push({
        kind: "your_tags",
        tags: [...tagsSeen].slice(0, 6),
        cards: hits.map((x) => x.c).slice(0, 6),
      });
    }
  }

  return tiles;
}
