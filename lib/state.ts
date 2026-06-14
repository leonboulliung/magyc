"use client";

import { getAnonDisplayName, getAnonToken } from "./anonId";
import { getActivePersona } from "./personas";
import { PALETTE, colorForId } from "./palette";
import type { ModuleStateEntry, ModuleStateKind } from "./types";

/**
 * The current actor's id — the value the server stamps on this
 * browser's collaborative actions (`actor.id`). Renderers compare
 * against it to answer "is this MY vote / claim / stroke?". It MUST
 * match what the API records, which is the anon token (persona-aware).
 *
 * This replaces six renderers that read a non-existent localStorage
 * key directly and so always saw an empty id.
 */
export function getSelfId(): string {
  return getAnonToken();
}

/** Stable colour for the current actor — persona swatch if a persona
 *  is active, else a deterministic pick from the anon token. */
export function getMyColor(): string {
  if (typeof window === "undefined") return PALETTE[0];
  const persona = getActivePersona();
  if (persona) return persona.swatch;
  return colorForId(getAnonToken());
}

/** Stable colour for a known actor id (anon token or user id). Used
 *  by renderers to show consistent attribution across page renders. */
export function colorFor(actorId: string): string {
  return colorForId(actorId);
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
// Optimistic local apply — mirrors the server's per-kind semantics
// ============================================================

/** Build the entry the server WILL create for an action, with a temp
 *  id. Appended locally before the write so the UI reacts instantly;
 *  the realtime INSERT replaces it with the real row. */
export function makeOptimisticEntry(
  spaceId: string,
  moduleIndex: number,
  kind: ModuleStateKind,
  data: Record<string, unknown>,
  actor?: { id: string; kind: "anon" | "user"; displayName?: string },
): ModuleStateEntry {
  const currentActor = actor ?? {
    kind: "anon" as const,
    id: getSelfId(),
    displayName: getAnonDisplayName() || undefined,
  };
  return {
    id: `tmp_${Math.random().toString(36).slice(2, 10)}`,
    spaceId,
    moduleIndex,
    actor: {
      kind: currentActor.kind,
      id: currentActor.id,
      displayName: currentActor.displayName,
      color: getMyColor(),
    },
    kind,
    // Tint the contribution with the actor's colour — unless the caller
    // set an explicit colour (the sketch tools pick their own).
    data: { ...data, color: typeof data.color === "string" ? data.color : getMyColor() },
    createdAt: Date.now(),
  };
}

/**
 * Apply an action to the local entry list the same way the server
 * applies it to the table, so the optimistic UI state matches what the
 * next read would return:
 *   vote  — one active vote per actor+module; empty option = retract
 *   check — one check per actor+itemKey; checked:false = remove
 *   claim — one claim per actor+slotLabel; claimed:false = release
 *   everything else — plain append
 */
export function applyActionLocally(
  entries: ModuleStateEntry[],
  entry: ModuleStateEntry,
): ModuleStateEntry[] {
  const me = entry.actor.id;
  const { moduleIndex, kind, data } = entry;
  let next = entries;

  if (kind === "vote") {
    next = next.filter(
      (e) => !(e.kind === "vote" && e.moduleIndex === moduleIndex && e.actor.id === me),
    );
    const option = typeof data.option === "string" ? data.option : "";
    if (!option) return next; // retraction — delete only
    return [...next, entry];
  }

  if (kind === "check") {
    const itemKey = typeof data.itemKey === "string" ? data.itemKey : "";
    next = next.filter(
      (e) => !(e.kind === "check" && e.moduleIndex === moduleIndex && e.actor.id === me &&
        e.data.itemKey === itemKey),
    );
    if (!data.checked) return next;
    return [...next, entry];
  }

  if (kind === "claim") {
    const slotLabel = typeof data.slotLabel === "string" ? data.slotLabel : "";
    next = next.filter(
      (e) => !(e.kind === "claim" && e.moduleIndex === moduleIndex && e.actor.id === me &&
        e.data.slotLabel === slotLabel),
    );
    if (data.claimed === false) return next; // release — delete only
    return [...next, entry];
  }

  return [...next, entry];
}

/**
 * Merge a realtime INSERT into the local list: drop the oldest matching
 * optimistic temp entry from the same actor (it has been confirmed),
 * then append the real row if it isn't already present.
 */
export function mergeRealtimeInsert(
  entries: ModuleStateEntry[],
  incoming: ModuleStateEntry,
  selfActorId = getSelfId(),
): ModuleStateEntry[] {
  let next = entries;
  if (incoming.actor.id === selfActorId) {
    const i = next.findIndex(
      (e) => e.id.startsWith("tmp_") &&
        e.moduleIndex === incoming.moduleIndex &&
        e.kind === incoming.kind,
    );
    if (i >= 0) next = [...next.slice(0, i), ...next.slice(i + 1)];
  }
  if (next.some((e) => e.id === incoming.id)) return next;
  return [...next, incoming];
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
