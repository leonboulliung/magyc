import type { Card } from "./types";

/**
 * Discover surface — purely derivative. Every tile reads from
 * relationships already present in the data: time-to-event, member
 * recency, area counts, tag overlap with the viewer's interests. No
 * AI, no extra inputs.
 *
 * Note: the old idea/thing split is gone. Tiles work on a single
 * Card[] now. "Resonating" used to mean "ideas with signals" — it's
 * been retired since signals don't exist anymore. We replaced it
 * with "fresh" — recently posted, no members yet, looking for a crew.
 */

export type DiscoverTile =
  | { kind: "tonight"; cards: Card[] }
  | { kind: "imminent"; cards: Card[] }
  | { kind: "fresh"; cards: Card[] }
  | { kind: "crew_forming"; cards: Card[] }
  | { kind: "area_cluster"; area: string; cards: Card[] }
  | { kind: "your_tags"; tags: string[]; cards: Card[] };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Strip the area suffix off a label so "Le Marais · Paris" groups
 *  with "Le Marais". */
function bareArea(label: string | undefined): string | null {
  if (!label) return null;
  const head = label.split("·")[0]?.trim();
  return head || null;
}

/** Count only confirmed (joined) members. Requests don't count. */
function joinedCount(c: Card): number {
  return c.members.filter((m) => m.state === "joined").length;
}

function joinedMembers(c: Card) {
  return c.members.filter((m) => m.state === "joined");
}

export function computeDiscoverTiles(
  cards: Card[],
  viewerTags: string[] = [],
): DiscoverTile[] {
  const tiles: DiscoverTile[] = [];
  const now = Date.now();

  // ── Imminent (< 90 min to start). Highest urgency band. ──
  const imminent = cards
    .filter((c) => c.startsAt && c.startsAt > now && c.startsAt - now <= 90 * 60_000)
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .slice(0, 4);
  if (imminent.length) tiles.push({ kind: "imminent", cards: imminent });

  // ── Tonight (≤ 12h to start). The "what's on" band. ──
  const tonight = cards
    .filter((c) => {
      if (!c.startsAt || c.startsAt <= now) return false;
      if (imminent.some((m) => m.id === c.id)) return false;
      return c.startsAt - now <= 12 * HOUR;
    })
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .slice(0, 6);
  if (tonight.length) tiles.push({ kind: "tonight", cards: tonight });

  // ── Crew forming: someone joined in the last 24h. ──
  const crewForming = cards
    .filter((c) =>
      joinedMembers(c).some((m) => now - m.joinedAt <= DAY),
    )
    .filter((c) => !imminent.some((m) => m.id === c.id))
    .filter((c) => !tonight.some((m) => m.id === c.id))
    .sort((a, b) => joinedCount(b) - joinedCount(a))
    .slice(0, 4);
  if (crewForming.length) tiles.push({ kind: "crew_forming", cards: crewForming });

  // ── Fresh: recently posted, no joined members yet, looking for a crew.
  //    Window: 7 days. Sorted by newest first. ──
  const fresh = cards
    .filter((c) => joinedCount(c) === 0)
    .filter((c) => now - c.createdAt <= 7 * DAY)
    .filter((c) => !imminent.some((m) => m.id === c.id))
    .filter((c) => !tonight.some((m) => m.id === c.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);
  if (fresh.length) tiles.push({ kind: "fresh", cards: fresh });

  // ── Area clusters: 3+ active cards grouped by the head of their
  //    location label. ──
  const byArea = new Map<string, Card[]>();
  for (const c of cards) {
    const q = bareArea(c.location?.label);
    if (!q) continue;
    const arr = byArea.get(q) ?? [];
    arr.push(c);
    byArea.set(q, arr);
  }
  const clusters = [...byArea.entries()]
    .filter(([, list]) => list.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);
  for (const [area, list] of clusters) {
    tiles.push({ kind: "area_cluster", area, cards: list.slice(0, 6) });
  }

  // ── Your tags: cards tagged with anything in the viewer's interests. ──
  if (viewerTags.length > 0) {
    const wantSet = new Set(viewerTags.map((t) => t.toLowerCase()));
    const matchTags = (c: Card): string[] =>
      c.tags.filter((t) => wantSet.has(t.toLowerCase()));
    const hits = cards
      .map((c) => ({ c, m: matchTags(c) }))
      .filter((x) => x.m.length > 0);
    if (hits.length) {
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
