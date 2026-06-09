"use client";

import { getAnonDisplayName, getAnonToken } from "./anonId";
import { getActivePersona } from "./personas";
import type { ModuleStateEntry, ModuleStateKind } from "./types";

const PALETTE = ["#7da3c0", "#d4a373", "#a3c08e", "#c0857d", "#8d8dc0", "#c0bd7d"];

/** Stable colour for the current actor — persona swatch if a persona
 *  is active, else a deterministic pick from the anon token. */
export function getMyColor(): string {
  if (typeof window === "undefined") return PALETTE[0];
  const persona = getActivePersona();
  if (persona) return persona.swatch;
  const seed = getAnonToken();
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

/** Stable colour for a known actor id (anon token or user id). Used
 *  by renderers to show consistent attribution across page renders. */
export function colorFor(actorId: string): string {
  let h = 0;
  for (let i = 0; i < actorId.length; i++) h = (h + actorId.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

/**
 * Client-side helper: POST a collaborative action to the space's
 * state endpoint. Used by every interactive module renderer.
 */
export async function postState(
  spaceId: string,
  moduleIndex: number,
  kind: ModuleStateKind,
  data: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(`/api/spaces/${spaceId}/state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      moduleIndex,
      kind,
      // Attach the actor's colour so renderers can attribute without
      // a profile lookup. Server stores it inside data; we read it
      // back through entry.data.color.
      data: { ...data, color: getMyColor() },
      anonToken: getAnonToken(),
      anonName: getAnonDisplayName(),
    }),
  });
  return res.ok;
}

// ============================================================
// Aggregations over the state list — used by renderers
// ============================================================

/** All entries for one module index, sorted oldest-first. */
export function stateFor(
  all: ModuleStateEntry[],
  moduleIndex: number,
): ModuleStateEntry[] {
  return all
    .filter((e) => e.moduleIndex === moduleIndex)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Latest 'edit' entry for a module (notes / stages last-write-wins). */
export function latestEdit(
  all: ModuleStateEntry[],
  moduleIndex: number,
): ModuleStateEntry | null {
  const list = stateFor(all, moduleIndex).filter((e) => e.kind === "edit");
  return list.length ? list[list.length - 1] : null;
}

/** Vote counts per option for a poll module. */
export function voteCounts(
  all: ModuleStateEntry[],
  moduleIndex: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of stateFor(all, moduleIndex)) {
    if (e.kind !== "vote") continue;
    const opt = typeof e.data.option === "string" ? e.data.option : "";
    if (!opt) continue;
    out[opt] = (out[opt] || 0) + 1;
  }
  return out;
}

/** My vote on a poll (anon or signed). */
export function myVote(
  all: ModuleStateEntry[],
  moduleIndex: number,
  selfId: string,
): string | null {
  for (const e of stateFor(all, moduleIndex)) {
    if (e.kind !== "vote") continue;
    if (e.actor.id === selfId) {
      return typeof e.data.option === "string" ? e.data.option : null;
    }
  }
  return null;
}

/** All checks (latest per (actor, item)). */
export function checksFor(
  all: ModuleStateEntry[],
  moduleIndex: number,
): Map<number, ModuleStateEntry[]> {
  const out = new Map<number, ModuleStateEntry[]>();
  for (const e of stateFor(all, moduleIndex)) {
    if (e.kind !== "check") continue;
    const idx = typeof e.data.itemIndex === "number" ? e.data.itemIndex : -1;
    if (idx < 0) continue;
    if (e.data.checked) {
      const arr = out.get(idx) || [];
      arr.push(e);
      out.set(idx, arr);
    }
  }
  return out;
}

/** Claims per slot label. */
export function claimsFor(
  all: ModuleStateEntry[],
  moduleIndex: number,
): Map<string, ModuleStateEntry> {
  const out = new Map<string, ModuleStateEntry>();
  for (const e of stateFor(all, moduleIndex)) {
    if (e.kind !== "claim") continue;
    const slot = typeof e.data.slotLabel === "string" ? e.data.slotLabel : "";
    if (!slot) continue;
    out.set(slot, e); // last write wins; the API enforces uniqueness anyway
  }
  return out;
}

/** Voices on an open_question, oldest first. */
export function voicesFor(
  all: ModuleStateEntry[],
  moduleIndex: number,
): ModuleStateEntry[] {
  return stateFor(all, moduleIndex).filter((e) => e.kind === "voice");
}

/** "Add" entries for tags or extended checklist. */
export function addsFor(
  all: ModuleStateEntry[],
  moduleIndex: number,
): ModuleStateEntry[] {
  return stateFor(all, moduleIndex).filter((e) => e.kind === "add");
}

export function actorLabel(e: ModuleStateEntry): string {
  return e.actor.displayName || (e.actor.kind === "anon" ? "anon" : `user-${e.actor.id.slice(-6)}`);
}

export { getAnonToken };
