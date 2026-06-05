import type { Card } from "./types";

/**
 * Klarheit — how legible / ready-to-act this thing already is.
 *
 * Not a percentage. Not a score 0-100. A four-step status derived from
 * a small list of *meaningful* checks: does this thing have what it
 * needs to actually happen, or are there still holes someone has to
 * close before joining?
 *
 * Bricks (each contributes one point):
 *  - has a location
 *  - has a start time
 *  - has ≥ 1 module (a brief, a roadmap, anything)
 *  - has ≥ 1 predefined role
 *  - has ≥ 1 role claimed (someone has stepped in)
 *
 * Ideas are exempted — they don't carry the "ready to act" semantics
 * (they're a question to the field, not a project). We still compute
 * a status for them so a future surface can use it, but downstream
 * UI usually only renders it on things.
 */
export type KlarheitLevel = "open" | "almost" | "clear" | "sharp";

export interface KlarheitStatus {
  level: KlarheitLevel;
  /** Number of bricks present (0..5). */
  bricks: number;
  /** Total number of bricks scored. Always 5 for things. */
  outOf: number;
  /** Human-readable label for the headline state. */
  label: string;
  /** Short list of what's still missing — drives the "Noch X offen" hint. */
  missing: string[];
}

export function computeKlarheit(card: Card): KlarheitStatus {
  const checks: { ok: boolean; missing: string }[] = [
    { ok: !!card.location, missing: "ein Ort" },
    { ok: card.startsAt != null, missing: "ein Startzeitpunkt" },
    { ok: card.modules.length > 0, missing: "ein Modul" },
    { ok: card.roles.length > 0, missing: "eine Rolle" },
    {
      ok:
        card.roles.some((r) => !!r.claimedBy) ||
        card.members.some((m) => m.state === "joined"),
      missing: "jemand der mitmacht",
    },
  ];

  const bricks = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.missing);

  let level: KlarheitLevel;
  let label: string;
  if (bricks <= 1) {
    level = "open";
    label = "Noch offen";
  } else if (bricks === 2 || bricks === 3) {
    level = "almost";
    label = "Fast klar";
  } else if (bricks === 4) {
    level = "clear";
    label = "Klar";
  } else {
    level = "sharp";
    label = "Sehr klar";
  }

  return { level, bricks, outOf: checks.length, label, missing };
}
